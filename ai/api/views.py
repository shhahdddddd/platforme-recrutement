import logging
import uuid
from datetime import timedelta

from django.core.files.storage import default_storage
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils.decorators import method_decorator
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings
from .models import KBDocument, QuizAnswer, QuizQuestion, QuizReport, QuizSession
from .tasks import (
    enqueue_answer_scoring,
    enqueue_kb_document_processing,
    enqueue_single_question_generation,
    finalize_session_report_if_ready,
)
from .utils import (
    extract_job_key_terms,
    normalize_seniority_level,
    redis_client,
    update_bm25_index,
)
from agents.matching.feedback_loop import store_feedback

logger = logging.getLogger(__name__)
STALE_GENERATING_SESSION_AGE = timedelta(minutes=10)


def is_stale_generating_session(session, question_count, current_time=None):
    current_time = current_time or now()
    expected_questions = getattr(session, 'num_questions', None)
    is_incomplete = expected_questions is None or question_count < expected_questions
    return (
        session.status == 'generating'
        and is_incomplete
        and session.created_at <= current_time - STALE_GENERATING_SESSION_AGE
    )


def _parse_boolean(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {'true', '1', 'yes', 'on'}:
            return True
        if normalized in {'false', '0', 'no', 'off'}:
            return False
    if isinstance(value, (int, float)) and value in {0, 1}:
        return bool(value)
    raise ValueError("Boolean value expected.")


def _serialize_session(session: QuizSession) -> dict:
    return {
        'id': str(session.id),
        'candidate_id': session.candidate_id,
        'job_offer_id': session.job_offer_id,
        'company_id': session.company_id,
        'status': session.status,
        'job_title': session.job_title,
        'job_description': session.job_description,
        'job_key_terms': extract_job_key_terms(session.job_title, session.job_description),
        'job_offer_type': session.job_offer_type,
        'seniority_level': session.seniority_level,
        'num_questions': session.num_questions,
        'difficulty_setting': session.difficulty_setting,
        'time_limit': session.time_limit,
        'total_score': session.total_score,
        'created_at': session.created_at,
        'started_at': session.started_at,
        'completed_at': session.completed_at,
        'deadline': session.deadline,
    }


def _serialize_question(question: QuizQuestion, answer: QuizAnswer | None = None, include_reference=False) -> dict:
    payload = {
        'id': str(question.id),
        'question_number': question.question_number,
        'question_text': question.question_text,
        'skill_targeted': question.skill_targeted,
        'difficulty': question.difficulty,
        'follow_up_hint': question.follow_up_hint,
        'estimated_answer_length': question.estimated_answer_length,
        'source_passage_indices': question.source_passage_indices,
        'hallucination_flag': question.hallucination_flag,
        'hr_approved': question.hr_approved,
        'generation_mode': 'kb_grounded' if question.source_passage_indices else 'job_description_fallback',
        'knowledge_gap_flag': not bool(question.source_passage_indices),
        # MCQ fields visible to candidates
        'choices': question.choices or [],          # ["option A", "option B", "option C", "option D"]
        'choices_labeled': [
            {'label': label, 'text': text}
            for label, text in zip('ABCD', question.choices or [])
        ],
    }
    if include_reference:
        # HR / review mode: reveal the answer key + explanation
        payload['reference_answer'] = question.reference_answer
        payload['correct_choice'] = question.correct_choice
        payload['explanation'] = question.explanation
    if answer is not None:
        payload['answer_id'] = str(answer.id)
        payload['selected_choice'] = answer.selected_choice
        payload['is_correct'] = answer.is_correct
        payload['answer_status'] = answer.status
        payload['answer_score'] = answer.final_score
        payload['scoring_reasoning'] = answer.scoring_reasoning
    return payload


def _serialize_report(session: QuizSession) -> dict | None:
    try:
        report = getattr(session, 'report', None)
        if report is None:
            return None
    except Exception as e:
        logger.warning(f"Could not access report for session {session.id}: {e}")
        return None

    try:
        answers = list(
            QuizAnswer.objects
            .select_related('question')
            .filter(session=session)
            .order_by('question__question_number')
        )

        return {
            'total_score': report.total_score_normalized,
            'narrative_summary': getattr(report, 'narrative_summary', ''),
            'skill_breakdown': getattr(report, 'skill_breakdown', {}),
            'critical_gaps': getattr(report, 'critical_gaps', []),
            'confirmed_strengths': getattr(report, 'confirmed_strengths', []),
            'interview_suggestions': getattr(report, 'interview_suggestions', []),
            'question_reports': [
            {
                'question_id': str(answer.question_id),
                'question_number': answer.question.question_number,
                'question_text': answer.question.question_text,
                'focus_area': answer.question.skill_targeted,
                'choices': answer.question.choices,
                'correct_choice': answer.question.correct_choice,
                'explanation': answer.question.explanation,
                'selected_choice': answer.selected_choice,
                'is_correct': answer.is_correct,
                'answer_text': answer.answer_text,
                'score': answer.final_score,
                'reasoning': answer.scoring_reasoning,
            }
            for answer in answers
        ],
        }
    except Exception as e:
        logger.error(f"Error serializing report for session {session.id}: {e}")
        return None


def _serialize_progress(session: QuizSession) -> dict:
    answers = QuizAnswer.objects.filter(session=session)
    return {
        'questions_generated': session.questions.count(),
        'questions_expected': session.num_questions,
        'answers_submitted': answers.count(),
        'answers_scored': answers.filter(status='scored').count(),
    }


@method_decorator(csrf_exempt, name='dispatch')
class CandidateSubmitAnswerView(APIView):
    """Candidate MCQ answer submission endpoint used by the mobile app."""

    VALID_CHOICES = {'A', 'B', 'C', 'D'}

    def post(self, request, question_id):
        question = get_object_or_404(QuizQuestion.objects.select_related('session'), id=question_id)
        session = question.session

        # Accept either 'choice' (preferred) or legacy 'answer' key
        raw_choice = (
            request.data.get('choice')
            or request.data.get('answer')
            or ''
        )
        selected = raw_choice.strip().upper()

        if not selected:
            return Response({'error': 'Field "choice" is required (A, B, C, or D).'}, status=400)
        if selected not in self.VALID_CHOICES:
            return Response({'error': f'Invalid choice "{selected}". Must be A, B, C, or D.'}, status=400)

        if session.status not in {'ready', 'in_progress'}:
            return Response(
                {'error': f'Quiz session is not accepting answers in status "{session.status}".'},
                status=409,
            )

        current_time = now()
        update_fields = []
        if session.status == 'ready':
            session.status = 'in_progress'
            update_fields.append('status')
        if session.started_at is None:
            session.started_at = current_time
            update_fields.append('started_at')
        # Add 5 second grace period to account for network latency
        grace_period = timedelta(seconds=5)
        if session.deadline and current_time > (session.deadline + grace_period):
            return Response({'error': 'The quiz deadline has been reached.'}, status=409)
        if update_fields:
            session.save(update_fields=update_fields)
            redis_client.set(f"session:status:{session.id}", session.status, ex=86400)

        answer, created = QuizAnswer.objects.get_or_create(
            session=session,
            question=question,
            defaults={'selected_choice': selected},
        )
        # Set answer_text via descriptor (it handles encryption internally)
        answer.answer_text = selected
        if not created:
            answer.selected_choice = selected

        answer.is_correct = None
        answer.status = 'pending'
        answer.rouge_score = 0.0
        answer.bert_score = 0.0
        answer.cosine_score = 0.0
        answer.llm_score = 0.0
        answer.final_score = 0.0
        answer.scoring_reasoning = ''
        answer.scored_at = None
        answer.save(update_fields=[
            'selected_choice', '_answer_text', 'is_correct',
            'status', 'rouge_score', 'bert_score', 'cosine_score',
            'llm_score', 'final_score', '_scoring_reasoning', 'scored_at',
        ])

        dispatch_mode = enqueue_answer_scoring(str(answer.id))
        return Response(
            {
                'status': 'pending',
                'answer_id': str(answer.id),
                'question_id': str(question.id),
                'selected_choice': selected,
                'dispatch_mode': dispatch_mode,
            },
            status=201 if created else 200,
        )


class AnswerStatusView(APIView):
    """Polling endpoint for a single answer scoring job."""

    def get(self, request, answer_id):
        answer = get_object_or_404(QuizAnswer.objects.select_related('question', 'session'), id=answer_id)
        return Response(
            {
                'status': answer.status,
                'score': answer.final_score,
                'reasoning': answer.scoring_reasoning,
                'question_id': str(answer.question_id),
                'session_id': str(answer.session_id),
            }
        )


class CandidateQuizSessionView(APIView):
    """Candidate quiz fetch/start endpoint used by the mobile app."""

    def get(self, request, session_id):
        session = get_object_or_404(QuizSession, id=session_id)
        if session.status not in {'ready', 'in_progress', 'completed'}:
            return Response(
                {'error': f'Quiz is not available in status "{session.status}".'},
                status=409,
            )

        current_time = now()
        # Add 5 second grace period to account for network latency between frontend timer and backend processing
        grace_period = timedelta(seconds=5)
        if session.deadline and current_time > (session.deadline + grace_period) and session.status != 'completed':
            return Response({'error': 'The quiz deadline has been reached.'}, status=409)

        answers = {
            str(answer.question_id): answer
            for answer in QuizAnswer.objects.filter(session=session)
        }
        questions = [
            _serialize_question(question, answers.get(str(question.id)))
            for question in session.questions.order_by('question_number')
        ]

        payload = {
            'session': _serialize_session(session),
            'progress': _serialize_progress(session),
            'questions': questions,
        }
        report_payload = _serialize_report(session)
        if report_payload is not None:
            payload['report'] = report_payload
        return Response(payload)

    def post(self, request, session_id):
        session = get_object_or_404(QuizSession, id=session_id)
        if session.status not in {'ready', 'in_progress'}:
            return Response(
                {'error': f'Quiz cannot be started from status "{session.status}".'},
                status=409,
            )

        current_time = now()
        # Add 5 second grace period to account for network latency
        grace_period = timedelta(seconds=5)
        if session.deadline and current_time > (session.deadline + grace_period):
            return Response({'error': 'The quiz deadline has been reached.'}, status=409)

        update_fields = []
        if session.status == 'ready':
            session.status = 'in_progress'
            update_fields.append('status')
        if session.started_at is None:
            session.started_at = current_time
            update_fields.append('started_at')
        if update_fields:
            session.save(update_fields=update_fields)
            redis_client.set(f"session:status:{session.id}", session.status, ex=86400)

        return Response({'status': session.status, 'session_id': str(session.id)})


class QuizReportView(APIView):
    """Detailed report endpoint used by HR dashboards and the candidate result screen."""

    def get(self, request, session_id):
        session = get_object_or_404(QuizSession, id=session_id)
        finalize_session_report_if_ready(str(session.id))
        session.refresh_from_db()

        payload = {
            'session': _serialize_session(session),
            'progress': _serialize_progress(session),
            'report': _serialize_report(session),
        }
        return Response(payload)


class HRReviewQuizView(APIView):
    """Draft quiz inspection and question editing endpoint for HR."""

    def get(self, request, session_id):
        session = get_object_or_404(QuizSession, id=session_id)
        question_count = session.questions.count()
        if is_stale_generating_session(session, question_count):
            session.status = 'failed'
            session.save(update_fields=['status'])
            redis_client.set(f"session:status:{session.id}", 'failed', ex=86400)
        questions = [
            _serialize_question(question, include_reference=True)
            for question in session.questions.order_by('question_number')
        ]
        return Response(
            {
                'session': _serialize_session(session),
                'progress': _serialize_progress(session),
                'questions': questions,
            }
        )

    def patch(self, request, question_id):
        question = get_object_or_404(QuizQuestion.objects.select_related('session'), id=question_id)
        if question.session.status != 'review':
            return Response(
                {'error': 'Questions can only be edited while the session is under review.'},
                status=409,
            )

        fields = {}
        if 'text' in request.data:
            fields['question_text'] = (request.data.get('text') or '').strip()
        if 'question_text' in request.data:
            fields['question_text'] = (request.data.get('question_text') or '').strip()
        if 'ref' in request.data:
            fields['reference_answer'] = (request.data.get('ref') or '').strip()
        if 'reference_answer' in request.data:
            fields['reference_answer'] = (request.data.get('reference_answer') or '').strip()
        if 'follow_up_hint' in request.data:
            fields['follow_up_hint'] = (request.data.get('follow_up_hint') or '').strip()
        if 'estimated_answer_length' in request.data:
            try:
                fields['estimated_answer_length'] = int(request.data.get('estimated_answer_length'))
            except (TypeError, ValueError):
                return Response({'error': 'estimated_answer_length must be an integer.'}, status=400)
        if 'difficulty' in request.data:
            fields['difficulty'] = (request.data.get('difficulty') or question.difficulty).strip().lower()
        if 'hr_approved' in request.data:
            try:
                fields['hr_approved'] = _parse_boolean(request.data.get('hr_approved'))
            except ValueError:
                return Response({'error': 'hr_approved must be a boolean.'}, status=400)
        
        # MCQ fields
        if 'choices' in request.data:
            choices = request.data.get('choices')
            if not isinstance(choices, list) or len(choices) != 4:
                return Response({'error': 'choices must be a list of 4 strings.'}, status=400)
            fields['choices'] = [str(c).strip() for c in choices]
            
        if 'correct_choice' in request.data:
            correct = str(request.data.get('correct_choice')).strip().upper()
            if correct not in {'A', 'B', 'C', 'D'}:
                return Response({'error': 'correct_choice must be A, B, C, or D.'}, status=400)
            fields['correct_choice'] = correct
            
        if 'explanation' in request.data:
            fields['explanation'] = (request.data.get('explanation') or '').strip()

        if not fields:
            return Response({'error': 'No editable fields were provided.'}, status=400)
        if not fields.get('question_text', question.question_text):
            return Response({'error': 'question_text cannot be empty.'}, status=400)

        for field_name, value in fields.items():
            setattr(question, field_name, value)
        question.save(update_fields=list(fields.keys()))

        return Response(
            {
                'status': 'updated',
                'question': _serialize_question(question, include_reference=True),
            }
        )

    def delete(self, request, question_id):
        question = get_object_or_404(QuizQuestion.objects.select_related('session'), id=question_id)
        session = question.session
        if session.status != 'review':
            return Response(
                {'error': 'Questions can only be removed while the session is under review.'},
                status=409,
            )

        with transaction.atomic():
            question.delete()
            # Reorder remaining questions to fill the gap
            remaining = session.questions.order_by('question_number')
            for i, q in enumerate(remaining, 1):
                if q.question_number != i:
                    q.question_number = i
                    q.save(update_fields=['question_number'])

        return Response({'status': 'deleted', 'message': 'Question removed and session reordered.'}, status=200)


class ReorderQuizView(APIView):
    """Persist a new HR-defined question order."""

    def post(self, request, session_id):
        session = get_object_or_404(QuizSession, id=session_id)
        if session.status != 'review':
            return Response({'error': 'Questions can only be reordered during review.'}, status=409)

        question_ids = request.data.get('question_ids')
        if not isinstance(question_ids, list) or not question_ids:
            return Response({'error': 'question_ids must be a non-empty list.'}, status=400)

        questions = list(session.questions.order_by('question_number'))
        known_ids = {str(question.id) for question in questions}
        ordered_ids = [str(question_id) for question_id in question_ids]
        if set(ordered_ids) != known_ids or len(ordered_ids) != len(questions):
            return Response({'error': 'question_ids must contain every question exactly once.'}, status=400)

        with transaction.atomic():
            for position, question_id in enumerate(ordered_ids, start=1):
                QuizQuestion.objects.filter(id=question_id, session=session).update(question_number=position)

        reordered = [
            _serialize_question(question, include_reference=True)
            for question in session.questions.order_by('question_number')
        ]
        return Response({'status': 'reordered', 'questions': reordered})


class RegenerateQuizQuestionView(APIView):
    """Deletes one draft question and regenerates it with the same slot and difficulty."""

    def post(self, request, question_id):
        question = get_object_or_404(QuizQuestion.objects.select_related('session'), id=question_id)
        session = question.session
        if session.status != 'review':
            return Response({'error': 'Questions can only be regenerated during review.'}, status=409)

        slot_index = question.question_number - 1
        difficulty = question.difficulty
        focus_label = question.skill_targeted
        session_id = str(session.id)

        logger.info(f"[Regenerate] Question {question_id} (slot {slot_index}, qnum {question.question_number}) for session {session_id}")

        if session.answers.filter(question=question).exists():
            return Response({'error': 'This question already has answers and cannot be regenerated.'}, status=409)

        with transaction.atomic():
            question.delete()
            # Set session back to generating status
            session.status = 'generating'
            session.save(update_fields=['status'])

        if focus_label:
            redis_client.srem(f"session:focuses:{session_id}", focus_label)
            logger.info(f"[Regenerate] Removed focus '{focus_label}' from Redis")

        dispatch_mode = enqueue_single_question_generation(session_id, slot_index, difficulty)
        logger.info(f"[Regenerate] Dispatched with mode={dispatch_mode}, slot={slot_index}")
        return Response(
            {
                'status': 'regenerating',
                'dispatch_mode': dispatch_mode,
                'question_number': slot_index + 1,
                'slot_index': slot_index,
            },
            status=202,
        )


class FinalizeQuizView(APIView):
    """Moves a generated draft from review to ready so the candidate can take it."""

    def post(self, request, session_id):
        session = get_object_or_404(QuizSession, id=session_id)
        question_count = session.questions.count()
        if question_count < session.num_questions:
            return Response(
                {'error': f'This session only has {question_count}/{session.num_questions} questions.'},
                status=409,
            )

        if session.status == 'ready':
            return Response(
                {
                    'status': 'ready',
                    'session_id': str(session.id),
                    'deadline': session.deadline.isoformat() if session.deadline else None,
                }
            )
        if session.status != 'review':
            return Response(
                {'error': f'Quiz cannot be finalized from status "{session.status}".'},
                status=409,
            )

        session.status = 'ready'
        session.started_at = None
        session.deadline = now() + timedelta(hours=48)
        session.save(update_fields=['status', 'started_at', 'deadline'])
        redis_client.set(f"session:status:{session.id}", 'ready', ex=86400)
        return Response(
            {
                'status': 'ready',
                'session_id': str(session.id),
                'deadline': session.deadline.isoformat() if session.deadline else None,
            }
        )


@method_decorator(csrf_exempt, name='dispatch')
class KBDocumentUploadView(APIView):
    """Knowledge-base upload and list endpoint."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        company_id = request.query_params.get('company_id', 1)
        docs = KBDocument.objects.filter(company_id=company_id).order_by('-created_at')
        return Response(
            [
                {
                    'id': str(doc.id),
                    'original_filename': doc.original_filename,
                    'status': doc.status,
                    'created_at': doc.created_at,
                    'total_sections': doc.total_sections,
                    'error_message': doc.error_message,
                }
                for doc in docs
            ]
        )

    def post(self, request):
        try:
            file_obj = request.FILES.get('file')
            if not file_obj:
                return Response({'error': 'No file received in "file" key.'}, status=400)

            company_id = int(request.data.get('company_id', 1))
            uploader_id = int(request.data.get('uploader_id', 1))
            doc = KBDocument.objects.create(
                company_id=company_id,
                uploader_id=uploader_id,
                original_filename=file_obj.name,
                minio_path=default_storage.save(f"kb/{uuid.uuid4()}_{file_obj.name}", file_obj),
            )

            dispatch_mode = enqueue_kb_document_processing(doc.id)
            return Response(
                {
                    'status': 'pending',
                    'document_id': str(doc.id),
                    'processing_mode': dispatch_mode,
                },
                status=201,
            )
        except Exception as exc:
            logger.error("Upload logic failure: %s", exc, exc_info=True)
            return Response({'error': f'Internal Server Error: {exc}'}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class KBDocumentDetailView(APIView):
    """Delete one uploaded knowledge-base document."""

    def delete(self, request, doc_id):
        doc = get_object_or_404(KBDocument, id=doc_id)
        storage_path = doc.minio_path
        company_id = doc.company_id

        try:
            if storage_path and default_storage.exists(storage_path):
                default_storage.delete(storage_path)

            doc.delete()
            update_bm25_index(company_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as exc:
            logger.error("Delete failure for %s: %s", doc_id, exc, exc_info=True)
            return Response({'error': str(exc)}, status=500)


class GenerateQuizView(APIView):
    """Legacy placeholder endpoint retained for compatibility."""

    def post(self, request):
        return Response({'status': 'generating'})


class StartQuizView(APIView):
    """Creates a quiz session and dispatches generation."""

    def post(self, request, candidate_id=None):
        try:
            cid = candidate_id or request.data.get('candidate_id')
            job_offer_id = request.data.get('job_offer_id')
            company_id = request.data.get('company_id')
            hr_initiator = request.data.get('hr_initiator_id', 1)
            num_questions = int(request.data.get('num_questions', 8))
            difficulty = request.data.get('difficulty', 'mixed')
            time_limit = request.data.get('time_limit')
            job_title = request.data.get('job_title', '')
            job_description = request.data.get('job_description', '')
            job_offer_type = request.data.get('offer_type', 'job')
            seniority_level = normalize_seniority_level(
                request.data.get('seniority_level') or request.data.get('seniority')
            )

            if not cid or not job_offer_id or not company_id:
                return Response(
                    {'error': 'candidate_id, job_offer_id and company_id are required'},
                    status=400,
                )

            from .models import ChildChunk

            has_ready_kb = ChildChunk.objects.filter(company_id=company_id, document__status='ready').exists()

            existing = QuizSession.objects.filter(
                candidate_id=int(cid),
                job_offer_id=int(job_offer_id),
                status__in=['generating', 'review', 'ready', 'in_progress', 'failed'],
            ).first()

            if existing:
                existing_question_count = existing.questions.count()
                if is_stale_generating_session(existing, existing_question_count):
                    existing.status = 'failed'
                    existing.save(update_fields=['status'])
                    redis_client.set(f"session:status:{existing.id}", "failed", ex=86400)
                else:
                    return Response(
                        {
                            'status': existing.status,
                            'session_id': str(existing.id),
                            'message': 'An active quiz session already exists.',
                        },
                        status=200,
                    )

            session = QuizSession.objects.create(
                candidate_id=int(cid),
                job_offer_id=int(job_offer_id),
                company_id=int(company_id),
                hr_initiator_id=int(hr_initiator),
                num_questions=num_questions,
                difficulty_setting=difficulty,
                time_limit=int(time_limit) if time_limit else None,
                job_title=job_title or '',
                job_description=job_description or '',
                job_skills=[],
                job_offer_type=job_offer_type or 'job',
                seniority_level=seniority_level,
                status='generating',
            )

            session_id_str = str(session.id)
            redis_client.delete(f"session:focuses:{session_id_str}")
            redis_client.set(f"session:status:{session_id_str}", "generating", ex=86400)

            from .tasks import enqueue_quiz_generation_preferred

            dispatch_mode = enqueue_quiz_generation_preferred(session_id_str)
            response_payload = {
                'status': 'generating',
                'session_id': session_id_str,
                'dispatch_mode': dispatch_mode,
                'job_key_terms': extract_job_key_terms(job_title, job_description),
            }
            if has_ready_kb:
                response_payload['message'] = 'Assessment generation started.'
            else:
                response_payload['message'] = (
                    'Assessment generation started without ready knowledge-base documents. '
                    'Questions will fall back to the job description when no grounded passages are available.'
                )
                response_payload['preparation_warning'] = 'knowledge_base_missing'
            return Response(response_payload, status=status.HTTP_202_ACCEPTED)

        except Exception as exc:
            logger.error("StartQuizView failure: %s", exc, exc_info=True)
            return Response({'error': str(exc)}, status=500)


# ---------------------------------------------------------------------------
# HIGH FIX: Missing POST /api/score/ endpoint
# Laravel AiMatchingService.php (line 61) calls this URL.
# Previously this returned 404 — ALL AI matching was silently broken.
# ---------------------------------------------------------------------------

class ScoreCvView(APIView):
    """
    POST /api/score/

    Called by Laravel's AiMatchingService when a candidate applies.
    Runs the full LangGraph agentic matching pipeline and returns structured scores.

    Expected payload (JSON):
        {
            "cv":         "/absolute/path/to/cv.pdf",
            "job_id":     123,
            "job_desc":   "Senior Python Engineer...",
            "skills_json": ["Python", "Django"],
            "degrees":    ["Bachelor"],
            "exp_levels": ["senior"],
            "exp_years":  3.0,
            "offer_type": "job",
            "is_internship": false,
            "duration":   0
        }
    """
    parser_classes = [JSONParser]

    def post(self, request):
        import asyncio
        import json as _json
        import sys
        import os
        from asgiref.sync import async_to_sync

        data = request.data

        cv_path = data.get('cv', '')
        if not cv_path or not os.path.isfile(cv_path):
            return Response(
                {'error': f'CV file not found: {cv_path}', 'score': 0},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normalise incoming fields — matches score_application.py logic
        try:
            skills = data.get('skills_json', [])
            if isinstance(skills, str):
                skills = _json.loads(skills)
            degrees = data.get('degrees', [])
            if isinstance(degrees, str):
                degrees = _json.loads(degrees)
            exp_levels = data.get('exp_levels', [])
            if isinstance(exp_levels, str):
                exp_levels = _json.loads(exp_levels)
        except Exception:
            skills, degrees, exp_levels = [], [], []

        offer_type = data.get('offer_type', 'job')
        is_internship = bool(data.get('is_internship', False))
        exp_years = float(data.get('exp_years', 0))
        duration = int(data.get('duration', 0))
        job_desc = str(data.get('job_desc', ''))
        job_id = data.get('job_id') or data.get('job_offer_id')
        candidate_id = data.get('candidate_id') or data.get('applicant_id')

        requirements = {
            'required_skills': skills,
            'required_degrees': degrees,
            'experience_levels': exp_levels,
            'required_experience_years': exp_years,
            'offer_type': offer_type,
            'internship_details': {'duration_months': duration if duration > 0 else None},
        }

        # Check for V3 enterprise mode
        use_enterprise = data.get('enterprise', False) or data.get('v3', False)

        try:
            # Import here to avoid circular deps at module load time
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            # NEW: Use V3 Fast Agent (2 LLM calls instead of 6)
            from agents.matching.agent_v3_fast import (
                run_matching_pipeline_fast,
                run_matching_pipeline_enterprise
            )
            from agents.matching.cache_manager import get_match_cache_manager

            cache_manager = get_match_cache_manager()
            if job_id is not None and not use_enterprise:
                cached_payload = cache_manager.get_cached_match(cv_path, str(job_id))
                if cached_payload:
                    for internal_key in ('_job_version', '_cv_path', '_job_id'):
                        cached_payload.pop(internal_key, None)
                    return Response(cached_payload, status=status.HTTP_200_OK)

            # Choose pipeline: Enterprise (V3 full) or Fast (V2/V3 basic)
            pipeline_fn = run_matching_pipeline_enterprise if use_enterprise else run_matching_pipeline_fast

            timeout_raw = getattr(settings, 'AI_SCORE_REQUEST_TIMEOUT_SECONDS', 180)
            try:
                score_timeout = max(10, int(timeout_raw))
            except (TypeError, ValueError):
                score_timeout = 180

            # Run pipeline via ASGI bridge without creating a nested event loop
            # in the request thread.
            async def _run_pipeline():
                return await asyncio.wait_for(
                    pipeline_fn(
                        cv_path=cv_path,
                        job_description=job_desc,
                        job_requirements=requirements,
                        candidate_id=candidate_id,
                        job_id=job_id,
                        offer_type=offer_type,
                    ),
                    timeout=score_timeout,
                )

            result = async_to_sync(_run_pipeline)()

            if not result or not result.get('success'):
                return Response({
                    'error': result.get('error', 'Matching pipeline failed'), 
                    'score': 0
                }, status=200)

            if result.get('final_score') == 0:
                return Response({
                    'error': 'Matching pipeline returned zero score.', 
                    'score': 0
                }, status=200)

            _gdpr_fields = {'phone', 'email', 'address'}

            # Build response payload with all V3 features if available
            response_payload = {
                'score':              result.get('final_score', 0),
                'semantic_score':     result.get('semantic_score', 0.0),
                'skill_score':        result.get('skill_coverage', 0.0),
                'experience_score':   result.get('experience_score', 0.0),
                'degree_score':       result.get('education_score', 0.0),
                'confidence_score':   result.get('confidence_score', result.get('confidence', 0.85)),
                'explanation':        result.get('explanation', {}),
                'risk':               result.get('risk', {}),
                'matched_skills':     result.get('matched_skills', []),
                'missing_skills':     result.get('missing_skills', []),
                'missing_critical':   result.get('missing_critical', []),
                'needs_manual_review': result.get('risk', {}).get('risk_level') == 'HIGH',
                'elapsed_time':       result.get('elapsed_time', 0),
                'profile': {
                    k: v for k, v in (result.get('candidate_profile') or {}).items()
                    if k not in _gdpr_fields
                },
            }

            # V3 Enterprise extra fields
            if use_enterprise:
                response_payload.update({
                    'gate_status': result.get('gate_status', 'UNKNOWN'),
                    'gate_reason': result.get('gate_reason', ''),
                    'z_score': result.get('z_score', 0.0),
                    'experience_relevance': result.get('experience_relevance', 0.0),
                    'weights_used': result.get('weights_used', {}),
                    'confidence_components': result.get('confidence_components', {}),
                    'cv_quality': result.get('cv_quality', {}),
                    'rarity_boost_applied': result.get('rarity_boost_applied', False),
                    'explanation': result.get('explanation', {}),
                })

            if job_id is not None:
                cache_manager.cache_match_result(cv_path, str(job_id), response_payload)

            return Response(response_payload, status=status.HTTP_200_OK)

        except asyncio.TimeoutError:
            logger.error(
                "ScoreCvView timed out for job_id=%s candidate_id=%s",
                job_id,
                candidate_id,
            )
            return Response(
                {'error': 'Matching pipeline timed out.', 'score': 0},
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            logger.error("ScoreCvView pipeline failure: %s", exc, exc_info=True)
            return Response({'error': str(exc), 'score': 0}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------------------------------------------------------------------
# BATCH SCORING: Fast parallel scoring for company applicants page
# ---------------------------------------------------------------------------

class BatchScoreApplicantsView(APIView):
    """
    POST /api/score/batch/

    Batch score multiple applicants in parallel for the company applicants page.
    Much faster than individual ScoreCvView calls.

    Expected payload (JSON):
        {
            "job_id": 123,
            "job_desc": "Senior Python Engineer...",
            "job_requirements": {
                "required_skills": ["Python", "Django"],
                "required_degrees": ["Bachelor"],
                "experience_levels": ["senior"],
                "required_experience_years": 3,
                "offer_type": "job"
            },
            "applicants": [
                {"cv_path": "/path/to/cv1.pdf", "applicant_id": 1},
                {"cv_path": "/path/to/cv2.pdf", "applicant_id": 2},
                ...
            ],
            "max_concurrent": 5
        }
    """
    parser_classes = [JSONParser]

    def post(self, request):
        import asyncio
        import json as _json
        import sys
        import os
        import time
        from asgiref.sync import async_to_sync

        data = request.data

        job_id = data.get('job_id')
        job_desc = data.get('job_desc', '')
        job_requirements = data.get('job_requirements', {})
        applicants = data.get('applicants', [])
        max_concurrent = min(int(data.get('max_concurrent', 5)), 10)  # Cap at 10

        if not applicants:
            return Response({'error': 'No applicants provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate all CV paths exist
        valid_applicants = []
        for app in applicants:
            cv_path = app.get('cv_path', '')
            if cv_path and os.path.isfile(cv_path):
                valid_applicants.append(app)

        if not valid_applicants:
            return Response({'error': 'No valid CV files found'}, status=status.HTTP_400_BAD_REQUEST)

        # NEW: Import V3 Fast Batch Matching
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from agents.matching.agent_v3_fast import run_batch_matching_fast
        from agents.matching.cache_manager import get_match_cache_manager

        cache_manager = get_match_cache_manager()
        start_time = time.time()

        # Extract candidate IDs and paths
        candidate_ids = [str(app.get('applicant_id', app.get('cv_path'))) for app in valid_applicants]

        # Check for V3 enterprise mode
        use_enterprise = data.get('enterprise', False) or data.get('v3', False)

        timeout_raw = getattr(settings, 'AI_BATCH_SCORE_REQUEST_TIMEOUT_SECONDS', 300)
        try:
            batch_timeout = max(15, int(timeout_raw))
        except (TypeError, ValueError):
            batch_timeout = 300

        # Run V3 Fast Batch Matching (fully parallel, single JD parse)
        try:
            async def _run_batch():
                return await asyncio.wait_for(
                    run_batch_matching_fast(
                        candidate_ids=candidate_ids,
                        job_id=job_id,
                        job_description=job_desc,
                        job_requirements=job_requirements,
                        use_v3=use_enterprise
                    ),
                    timeout=batch_timeout,
                )

            batch_results = async_to_sync(_run_batch)()
        except asyncio.TimeoutError:
            logger.error(
                "Batch scoring timed out for job_id=%s (candidates=%d)",
                job_id,
                len(candidate_ids),
            )
            return Response(
                {'error': 'Batch scoring timed out.'},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except Exception as exc:
            logger.error(f"Batch scoring failed: {exc}", exc_info=True)
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Transform results to expected format
        results = []
        for i, match_result in enumerate(batch_results):
            applicant = valid_applicants[i]
            applicant_id = applicant.get('applicant_id')
            cv_path = applicant.get('cv_path')

            if not match_result.get('success'):
                results.append({
                    'applicant_id': applicant_id,
                    'cv_path': cv_path,
                    'status': 'error',
                    'error': match_result.get('error', 'Matching failed'),
                    'score': 0
                })
                continue

            # Build response payload
            _gdpr_fields = {'phone', 'email', 'address'}
            payload = {
                'score': match_result.get('score', 0),
                'semantic_score': match_result.get('semantic_score', 0.0),
                'skill_score': match_result.get('skill_coverage', 0.0),
                'experience_score': match_result.get('experience_score', 0.0),
                'degree_score': match_result.get('education_score', 0.0),
                'confidence_score': match_result.get('confidence', 0.85),
                'explanation': {
                    'summary': f"Match score: {match_result.get('score', 0)*100:.0f}%",
                    'risk_level': match_result.get('risk', {}).get('risk_level', 'UNKNOWN'),
                },
                'risk': match_result.get('risk', {}),
                'matched_skills': [m['job_skill'] for m in match_result.get('matched_skills', [])],
                'missing_skills': match_result.get('missing_skills', []),
                'needs_manual_review': match_result.get('risk', {}).get('risk_level') == 'HIGH',
                'profile': {
                    k: v for k, v in (match_result.get('candidate_profile') or {}).items()
                    if k not in _gdpr_fields
                },
            }

            # Cache the result
            if job_id is not None:
                cache_manager.cache_match_result(cv_path, str(job_id), payload)

            results.append({
                'applicant_id': applicant_id,
                'cv_path': cv_path,
                'status': 'success',
                'cached': False,
                'score': payload['score'],
                'results': payload
            })

        elapsed = time.time() - start_time

        # Calculate stats
        success_count = sum(1 for r in results if r['status'] == 'success')
        cached_count = sum(1 for r in results if r.get('cached', False))
        error_count = len(results) - success_count

        return Response({
            'total': len(valid_applicants),
            'successful': success_count,
            'cached': cached_count,
            'errors': error_count,
            'elapsed_seconds': round(elapsed, 2),
            'applicants_per_second': round(len(valid_applicants) / elapsed, 2) if elapsed > 0 else 0,
            'results': results
        })


# ---------------------------------------------------------------------------
# ChromaDB Vector Store Management Endpoints
# ---------------------------------------------------------------------------

class VectorStoreStatsView(APIView):
    """Get statistics about ChromaDB collections for companies."""

    def get(self, request):
        from .rag.retrieval.vector_store import get_collection_stats
        from .models import ParentChunk
        from django.db.models import Count

        # Get all companies with chunks
        companies_with_chunks = (
            ParentChunk.objects
            .values('company_id')
            .annotate(chunk_count=Count('id'))
            .order_by('company_id')
        )

        stats = []
        for company in companies_with_chunks:
            company_id = company['company_id']
            chroma_stats = get_collection_stats(company_id)
            stats.append({
                'company_id': company_id,
                'postgres_chunks': company['chunk_count'],
                'chroma_chunks': chroma_stats.get('chunk_count', 0),
                'collection_exists': chroma_stats.get('exists', False),
            })

        return Response({
            'companies': stats,
            'total_companies': len(stats),
        })


class VectorStoreHealthView(APIView):
    """Health check for ChromaDB and embedding service."""

    def get(self, request):
        from .rag.retrieval.vector_store import health_check, get_chroma_client, get_embedding_function
        import httpx

        health = {
            'chromadb': health_check(),
            'ollama': {'status': 'unknown'},
            'redis': {'status': 'unknown'},
        }

        # Check Ollama embedding service
        try:
            ollama_url = getattr(settings, 'OLLAMA_EMBED_URL', 'http://127.0.0.1:11434')
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{ollama_url.replace('/api/embed', '')}/api/tags")
                if response.status_code == 200:
                    models = response.json().get('models', [])
                    model_names = [m.get('name', '') for m in models]
                    target_model = getattr(settings, 'OLLAMA_EMBED_MODEL', 'nomic-embed-text')
                    health['ollama'] = {
                        'status': 'healthy',
                        'models_available': model_names,
                        'embedding_model_ready': any(target_model in name for name in model_names),
                    }
                else:
                    health['ollama'] = {'status': 'unhealthy', 'error': f'HTTP {response.status_code}'}
        except Exception as e:
            health['ollama'] = {'status': 'unhealthy', 'error': str(e)}

        # Check Redis
        try:
            redis_client.ping()
            health['redis'] = {'status': 'healthy'}
        except Exception as e:
            health['redis'] = {'status': 'unhealthy', 'error': str(e)}

        # Overall status
        all_healthy = all(
            h.get('status') == 'healthy' 
            for h in health.values()
        )
        health['overall'] = 'healthy' if all_healthy else 'degraded'

        return Response(health)


# ---------------------------------------------------------------------------
# AI Service Health Check (for diagnostics)
# ---------------------------------------------------------------------------

class AIServiceHealthView(APIView):
    """
    GET /api/ai-health/

    Quick health check for AI services (Ollama, LLM providers).
    Returns response times and availability status.
    """

    def get(self, request):
        import asyncio
        import time
        import httpx
        from django.conf import settings

        results = {
            'ollama': {'status': 'unknown', 'response_ms': None, 'error': None},
            'ollama_embed': {'status': 'unknown', 'response_ms': None, 'error': None},
            'gemini': {'status': 'unknown', 'response_ms': None, 'error': None},
            'timestamp': time.time(),
        }

        async def check_ollama():
            """Check Ollama list endpoint."""
            start = time.time()
            try:
                ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{ollama_url}/api/tags")
                    elapsed = (time.time() - start) * 1000
                    if response.status_code == 200:
                        return {'status': 'healthy', 'response_ms': round(elapsed, 2)}
                    else:
                        return {'status': 'unhealthy', 'response_ms': round(elapsed, 2), 'error': f'HTTP {response.status_code}'}
            except Exception as e:
                return {'status': 'unhealthy', 'response_ms': round((time.time() - start) * 1000, 2), 'error': str(e)}

        async def check_ollama_embed():
            """Check Ollama embedding endpoint with a small test."""
            start = time.time()
            try:
                ollama_url = getattr(settings, 'OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
                model = getattr(settings, 'OLLAMA_EMBED_MODEL', 'nomic-embed-text')
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{ollama_url}/api/embed",
                        json={"model": model, "input": "test"}
                    )
                    elapsed = (time.time() - start) * 1000
                    if response.status_code == 200:
                        return {'status': 'healthy', 'response_ms': round(elapsed, 2)}
                    else:
                        return {'status': 'unhealthy', 'response_ms': round(elapsed, 2), 'error': f'HTTP {response.status_code}'}
            except Exception as e:
                return {'status': 'unhealthy', 'response_ms': round((time.time() - start) * 1000, 2), 'error': str(e)}

        async def check_gemini():
            """Check if Gemini API key is configured."""
            start = time.time()
            try:
                api_key = getattr(settings, 'GEMINI_API_KEY', None)
                if not api_key:
                    return {'status': 'not_configured', 'response_ms': None, 'error': 'No API key'}

                # Try a quick generation
                try:
                    from google import genai
                    def _call():
                        client = genai.Client(api_key=api_key)
                        try:
                            return client.models.generate_content(
                                model=getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash'),
                                contents="Say OK",
                            )
                        finally:
                            client.close()

                    response = await asyncio.to_thread(_call)
                    elapsed = (time.time() - start) * 1000
                    if response.text:
                        return {'status': 'healthy', 'response_ms': round(elapsed, 2)}
                    return {'status': 'degraded', 'response_ms': round(elapsed, 2), 'error': 'Empty response'}
                except ImportError:
                    return {'status': 'not_installed', 'response_ms': None, 'error': 'google-genai not installed'}
            except Exception as e:
                return {'status': 'unhealthy', 'response_ms': round((time.time() - start) * 1000, 2), 'error': str(e)}

        async def run_checks():
            results['ollama'] = await check_ollama()
            results['ollama_embed'] = await check_ollama_embed()
            results['gemini'] = await check_gemini()

        try:
            asyncio.run(run_checks())
        except Exception as e:
            results['error'] = str(e)

        # Overall status
        healthy_count = sum(1 for s in results.values() if isinstance(s, dict) and s.get('status') == 'healthy')
        results['overall'] = 'healthy' if healthy_count >= 2 else 'degraded'
        results['healthy_services'] = healthy_count

        return Response(results)

class FeedbackView(APIView):
    """
    POST /api/feedback/
    Store recruitment decision to improve AI matching accuracy over time.
    
    V3: Now stores detailed match results for multi-signal learning.
    """
    def post(self, request):
        import asyncio
        import sys
        import os

        data = request.data
        candidate_id = data.get('candidate_id')
        job_id = data.get('job_id')
        decision = data.get('decision')  # 'hired', 'rejected', 'interview', 'shortlisted'
        scores = data.get('scores', {})
        match_result = data.get('match_result', {})  # Full match result from enterprise API

        if not candidate_id or not job_id or not decision:
            return Response({'error': 'candidate_id, job_id, and decision are required'}, status=400)

        # Validate decision
        valid_decisions = ['hired', 'rejected', 'interview', 'shortlisted', 'interviewed']
        if decision not in valid_decisions:
            return Response({'error': f'decision must be one of {valid_decisions}'}, status=400)

        # Normalize 'interviewed' to 'interview'
        if decision == 'interviewed':
            decision = 'interview'

        # Use new V3 feedback storage if match_result provided
        if match_result:
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from agents.matching.agent_v3_fast import store_hiring_feedback

            success = asyncio.run(store_hiring_feedback(
                match_result=match_result,
                outcome=decision,
                candidate_id=str(candidate_id),
                job_id=int(job_id)
            ))

            if success:
                return Response({
                    'status': 'feedback_stored',
                    'message': 'V3 Learning system recorded detailed match data for future improvements.',
                    'v3': True
                })
            else:
                return Response({
                    'status': 'partial',
                    'message': 'V3 storage failed, falling back to legacy system.',
                    'v3': False
                }, status=500)

        # Fallback to legacy feedback storage
        store_feedback(candidate_id, job_id, decision, scores)

        return Response({
            'status': 'feedback_stored',
            'message': 'System will adapt based on this feedback.',
            'v3': False
        })
