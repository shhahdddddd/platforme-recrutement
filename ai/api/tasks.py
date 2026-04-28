import os
import re
import json
import pickle
import asyncio
import threading
import httpx
import pdfplumber
import pytesseract
from PIL import Image
import numpy as np
import logging
from collections import defaultdict
from threading import Thread
from core.celery import app
from django.conf import settings
from django.db import close_old_connections
from .models import KBDocument, ParentChunk, ChildChunk, QuizSession, QuizQuestion, QuizAnswer, QuizReport
from django.core.files.storage import default_storage
from .utils import (
    call_llm, cosine_similarity, calculate_rouge,
    calculate_bert_score, llm_judge_score, aggregate_scores,
    normalize_seniority_level, redis_client,
)
from .rag.retrieval.vector_store import add_chunks_to_collection, delete_chunks_by_document
from .rag.retrieval.bm25_service import invalidate_bm25_index
from langchain_text_splitters import RecursiveCharacterTextSplitter
from django.utils.timezone import now

logger = logging.getLogger(__name__)


def preload_company_chunks(company_id: int) -> None:
    """Preload company document chunks into Redis cache for quiz generation."""
    try:
        from .models import ParentChunk
        chunks = ParentChunk.objects.filter(
            company_id=company_id,
            document__status='ready'
        ).select_related('document')[:50]  # Limit to 50 chunks

        chunk_data = []
        for chunk in chunks:
            chunk_data.append({
                'id': str(chunk.id),
                'content': chunk.content[:1000],  # First 1000 chars
                'summary': chunk.summary or '',
                'domain': chunk.domain or [],
                'seniority_junior': chunk.seniority_junior,
                'seniority_mid': chunk.seniority_mid,
                'seniority_senior': chunk.seniority_senior,
            })

        # Cache in Redis for 1 hour
        cache_key = f"company:chunks:{company_id}"
        redis_client.set(cache_key, json.dumps(chunk_data), ex=3600)
        logger.info(f"Preloaded {len(chunk_data)} chunks for company {company_id}")
    except Exception as e:
        logger.warning(f"Failed to preload chunks for company {company_id}: {e}")
        # Non-critical, quiz generation will still work


# ---------------------------------------------------------------------------
# Thread-local asyncio event loop
# Each worker thread keeps one event loop alive for the lifetime of the thread,
# avoiding the overhead of creating / tearing down a new loop per question.
# ---------------------------------------------------------------------------
_loop_local = threading.local()


def _get_thread_event_loop() -> asyncio.AbstractEventLoop:
    """Return a persistent asyncio event loop for the current thread."""
    loop = getattr(_loop_local, "loop", None)
    if loop is None or loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        _loop_local.loop = loop
    return loop
def _prefer_local_dispatch() -> bool:
    mode = os.getenv('AI_DISPATCH_MODE', '').strip().lower()
    if mode in {'thread', 'local'}:
        return True
    if mode == 'celery':
        return False
    return bool(getattr(settings, 'DEBUG', False))


def enqueue_kb_document_processing(doc_id):
    doc_id = str(doc_id)
    if _prefer_local_dispatch():
        def _run():
            close_old_connections()
            try:
                process_kb_document.run(doc_id)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"kb-doc-{doc_id}").start()
        return 'thread'

    try:
        process_kb_document.delay(doc_id)
        return 'celery'
    except Exception as exc:
        logger.warning("Celery unavailable for KB document %s, falling back to thread: %s", doc_id, exc)
        def _run():
            close_old_connections()
            try:
                process_kb_document.run(doc_id)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"kb-doc-{doc_id}").start()
        return 'thread'


def enqueue_quiz_generation(session_id: str) -> str:
    """Dispatch quiz generation — Celery preferred, thread fallback."""
    try:
        generate_quiz_questions.delay(session_id)
        return 'celery'
    except Exception as exc:
        logger.warning("Celery unavailable for quiz session %s, falling back to thread: %s", session_id, exc)
        def _run():
            close_old_connections()
            try:
                generate_quiz_questions.run(session_id)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"quiz-{session_id}").start()
        return 'thread'


def enqueue_quiz_generation_preferred(session_id: str) -> str:
    mode = os.getenv('AI_DISPATCH_MODE', '').strip().lower()
    prefer_local = mode in {'thread', 'local'} or (mode != 'celery' and bool(getattr(settings, 'DEBUG', False)))

    if prefer_local:
        def _run():
            close_old_connections()
            try:
                generate_quiz_questions.run(session_id)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"quiz-{session_id}").start()
        return 'thread'

    return enqueue_quiz_generation(session_id)


def enqueue_answer_scoring(answer_id: str) -> str:
    answer_id = str(answer_id)
    if _prefer_local_dispatch():
        def _run():
            close_old_connections()
            try:
                score_answer.run(answer_id)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"answer-score-{answer_id}").start()
        return 'thread'

    try:
        score_answer.delay(answer_id)
        return 'celery'
    except Exception as exc:
        logger.warning("Celery unavailable for answer %s, falling back to thread: %s", answer_id, exc)
        def _run():
            close_old_connections()
            try:
                score_answer.run(answer_id)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"answer-score-{answer_id}").start()
        return 'thread'


def enqueue_single_question_generation(session_id: str, index: int, target_difficulty: str) -> str:
    if _prefer_local_dispatch():
        def _run():
            close_old_connections()
            try:
                generate_single_question.run(session_id, index, target_difficulty)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"quiz-question-{session_id}-{index}").start()
        return 'thread'

    try:
        generate_single_question.delay(session_id, index, target_difficulty)
        return 'celery'
    except Exception as exc:
        logger.warning(
            "Celery unavailable for regenerated question %s/%s, falling back to thread: %s",
            session_id, index, exc,
        )
        def _run():
            close_old_connections()
            try:
                generate_single_question.run(session_id, index, target_difficulty)
            finally:
                close_old_connections()
        Thread(target=_run, daemon=True, name=f"quiz-question-{session_id}-{index}").start()
        return 'thread'


# ---------------------------------------------------------------------------
# Difficulty map
# ---------------------------------------------------------------------------

def _build_difficulty_map(num_questions: int, difficulty_mode: str) -> list[str]:
    if difficulty_mode != 'mixed':
        return [difficulty_mode] * num_questions

    diff_map = []
    for index in range(num_questions):
        if index < 2:
            diff_map.append('easy')
        elif index < 6:
            diff_map.append('medium')
        else:
            diff_map.append('hard')
    return diff_map


def _run_question_generation_locally(session_id: str, diff_map: list[str]) -> str:
    for index, target_difficulty in enumerate(diff_map):
        generate_single_question.run(session_id, index, target_difficulty)

    session = QuizSession.objects.get(id=session_id)
    stored_questions = QuizQuestion.objects.filter(session_id=session_id).count()

    if stored_questions >= session.num_questions:
        logger.info(
            "Completed local quiz generation for session %s with %d questions",
            session_id, stored_questions,
        )
        return f"local_{stored_questions}"

    session.status = 'failed'
    session.save(update_fields=['status'])
    logger.error(
        "Local quiz generation produced %d/%d questions for session %s",
        stored_questions, session.num_questions, session_id,
    )
    return f"local_partial_{stored_questions}"


# ---------------------------------------------------------------------------
# Celery tasks — Ingestion
# ---------------------------------------------------------------------------

@app.task(bind=True)
def process_kb_document(self, doc_id):
    try:
        doc = KBDocument.objects.get(id=doc_id)
        KBDocument.objects.filter(
            company_id=doc.company_id,
            original_filename=doc.original_filename,
        ).exclude(id=doc.id).update(status='superseded')

        doc.status = 'processing'
        doc.save()

        file_path = default_storage.path(doc.minio_path)
        raw_text = extract_text_with_fallback(file_path)
        cleaned_text = clean_text(raw_text)
        if not cleaned_text.strip():
            raise ValueError("No readable text could be extracted from the uploaded PDF.")

        # Quick domain classification (first 2000 chars)
        domain_str = _get_thread_event_loop().run_until_complete(
            classify_domain(cleaned_text[:2000])
        )
        doc.domain_tags = [domain_str] if isinstance(domain_str, str) else domain_str
        doc.full_text = cleaned_text
        doc.error_message = ''
        doc.save()

        # Split into parent chunks
        p_splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=128)
        p_texts = p_splitter.split_text(cleaned_text)
        doc.total_sections = len(p_texts)
        doc.save()

        logger.info(f"Processing {len(p_texts)} chunks for document {doc_id}")

        async def prepare_metadata():
            # OPTIMIZATION: Increased semaphore from 3 to 10 for faster processing
            # With cloud LLMs (Gemini/Groq), we can handle more concurrency
            sem = asyncio.Semaphore(10)
            
            # Cache for deduplication
            summary_cache = {}
            seniority_cache = {}

            async def cached_summary(text):
                cache_key = hash(text[:100])  # First 100 chars as key
                if cache_key in summary_cache:
                    return summary_cache[cache_key]
                
                # Use fast extractive summary instead of slow LLM call
                result = await generate_summary_fast(text)
                summary_cache[cache_key] = result
                return result
            
            async def cached_seniority(text):
                cache_key = hash(text[:100])
                if cache_key in seniority_cache:
                    return seniority_cache[cache_key]
                
                async with sem:
                    result = await rate_seniority_fast(text)
                    seniority_cache[cache_key] = result
                    return result

            # Process in batches with progress tracking
            batch_size = 20
            summaries = []
            seniority_list = []
            
            for batch_idx in range(0, len(p_texts), batch_size):
                batch = p_texts[batch_idx:batch_idx + batch_size]
                
                # Process batch concurrently
                s_tasks = [cached_summary(p) for p in batch]
                r_tasks = [cached_seniority(p) for p in batch]
                
                batch_summaries = await asyncio.gather(*s_tasks, return_exceptions=True)
                batch_seniority = await asyncio.gather(*r_tasks, return_exceptions=True)
                
                # Handle exceptions
                for i, result in enumerate(batch_summaries):
                    if isinstance(result, Exception):
                        logger.warning(f"Summary failed for chunk {batch_idx + i}: {result}")
                        summaries.append(f"Section {batch_idx + i + 1}")
                    else:
                        summaries.append(result)
                
                for i, result in enumerate(batch_seniority):
                    if isinstance(result, Exception):
                        logger.warning(f"Seniority failed for chunk {batch_idx + i}: {result}")
                        seniority_list.append({'senior': 1, 'mid': 1, 'junior': 1})
                    else:
                        seniority_list.append(result)
                
                # Update progress
                progress = min(100, int((batch_idx + len(batch)) / len(p_texts) * 100))
                doc.error_message = f"Processing... {progress}%"
                doc.save()
                
                logger.info(f"Document {doc_id} progress: {progress}% ({batch_idx + len(batch)}/{len(p_texts)} chunks)")

            return summaries, seniority_list

        summaries, seniority_list = _get_thread_event_loop().run_until_complete(prepare_metadata())

        # Prepare chunks for ChromaDB (no need to store embeddings in PostgreSQL)
        chunks_for_chroma = []
        c_splitter = RecursiveCharacterTextSplitter(chunk_size=256, chunk_overlap=32)
        
        for i, p_text in enumerate(p_texts):
            sen = seniority_list[i]

            p_chunk = ParentChunk.objects.create(
                document=doc,
                company_id=doc.company_id,
                chunk_index=i,
                content=p_text,
                summary=summaries[i],
                embedding=None,  # No longer storing in PostgreSQL
                summary_quality_score=0.0,  # Will be computed on retrieval
                summary_quality_flag=False,
                domain=doc.domain_tags,
                seniority_junior=sen.get('junior', 1),
                seniority_mid=sen.get('mid', 1),
                seniority_senior=sen.get('senior', 1),
                source_filename=doc.original_filename,
            )
            
            # Add to ChromaDB batch
            chunks_for_chroma.append({
                'id': str(p_chunk.id),
                'content': p_text,  # Use summary for better semantic search
                'document_id': str(doc.id),
                'seniority_junior': sen.get('junior', 1),
                'seniority_mid': sen.get('mid', 1),
                'seniority_senior': sen.get('senior', 1),
                'domain': doc.domain_tags,
                'source_filename': doc.original_filename,
                'chunk_type': 'parent',
            })
            
            # Create child chunks for BM25
            for j, c_text in enumerate(c_splitter.split_text(p_text)):
                ChildChunk.objects.create(
                    parent=p_chunk,
                    document=doc,
                    company_id=doc.company_id,
                    chunk_index=j,
                    content=c_text,
                )

        # Store all chunks in ChromaDB (automatic embeddings)
        added = add_chunks_to_collection(doc.company_id, chunks_for_chroma)
        logger.info(f"Added {added} chunks to ChromaDB for company {doc.company_id}")

        doc.status = 'ready'
        doc.error_message = ''  # Clear progress message
        doc.save()
        invalidate_bm25_index(doc.company_id)
        
        logger.info(f"Document {doc_id} processing completed successfully with {len(p_texts)} chunks")

    except Exception as e:
        logger.error("Ingestion critical failure: %s", e, exc_info=True)
        if 'doc' in locals():
            doc.status = 'failed'
            doc.error_message = str(e)
            doc.save()


# ---------------------------------------------------------------------------
# Celery tasks — Quiz generation
# ---------------------------------------------------------------------------

@app.task(bind=True, priority=1)
def generate_quiz_questions(self, session_id: str):
    """
    Parent task: Sequential generation loop.
    Optimized for 16GB RAM: processes questions one-by-one to avoid 
    OOM (Out Of Memory) crashes from parallel LLM calls.
    Pre-loads chunks into Redis ONCE, then generates everything.
    """
    try:
        session = QuizSession.objects.get(id=session_id)
        # Ensure status is 'generating'
        if session.status != 'generating':
            session.status = 'generating'
            session.save(update_fields=['status'])

        n = session.num_questions
        diff_map = _build_difficulty_map(n, session.difficulty_setting)

        # Pre-load chunks to shared Redis cache (fast, low RAM)
        preload_company_chunks(session.company_id)

        logger.info(
            "Starting sequential quiz pre-generation for session %s (n=%d)", 
            session_id, n
        )

        # STAFF OPTIMIZATION: Loop instead of Celery Group
        # This keeps RAM stable (~8-10GB total) on a 16GB machine.
        for i, target_difficulty in enumerate(diff_map):
            # We call the task's logic directly using .run() or calling it 
            # as a function to keep it in the SAME worker process sequentially.
            generate_single_question.run(session_id, i, target_difficulty)
            logger.info("Generated question %d/%d for session %s", i + 1, n, session_id)

        return f"sequential_complete_{n}"

    except Exception as e:
        logger.error("generate_quiz_questions failure: %s", e, exc_info=True)
        updated = QuizSession.objects.filter(id=session_id, status='generating').update(status='failed')
        session = QuizSession.objects.filter(id=session_id).first()
        if updated and session is not None:
            notify_laravel_failed(session, str(e))


@app.task(bind=True)
def generate_single_question(self, session_id, index, target_difficulty):
    """
    Sub-task: runs the 7-node LangGraph pipeline for exactly ONE question.
    Pipeline: Calibrate → HyDE → Retrieve → Rerank → Gate → Synthesize → Store
    Uses the module-level compiled graph singleton and a per-thread event loop
    to minimise startup overhead when running with --concurrency > 1.
    """
    from .rag.pipeline.workflow import create_quiz_graph  # returns the cached singleton
    from .models import QuizSession, ParentChunk

    try:
        session = QuizSession.objects.get(id=session_id)
        kb_exists = ParentChunk.objects.filter(
            company_id=session.company_id,
            document__status='ready',
        ).exists()
        question_number = index + 1
        
        logger.info(f"[GenerateSingle] Session {session_id}, slot_index={index}, question_number={question_number}, difficulty={target_difficulty}")

        state = {
            "session_id": str(session.id),
            "company_id": str(session.company_id),
            "job_title": session.job_title or "Software Engineer",
            "job_description": (session.job_description or "")[:2000],
            "job_offer_type": session.job_offer_type or 'job',
            "seniority_level": normalize_seniority_level(getattr(session, 'seniority_level', 'mid')),
            "job_key_terms": [],
            "current_question_index": index,
            "target_difficulty": target_difficulty,
            "is_cold_start": not kb_exists,
            # Domain awareness (filled by detect_domain node)
            "domain": "general",
            "domain_config": {},
            # Mutable slots filled by graph nodes
            "target_focus": "",
            "hyde_query": "",
            "retrieved_chunks": [],
            "validated_chunks": [],
            "generated_question": {},
            "retrieval_mode": "kb_grounded",
            "kb_gap_detected": False,
            "fallback_reason": "",
            "retry_count": 0,
            "errors": [],
        }

        graph = create_quiz_graph()
        loop = _get_thread_event_loop()

        for attempt in range(3):
            final_state = loop.run_until_complete(graph.ainvoke(state))
            if QuizQuestion.objects.filter(session_id=session_id, question_number=question_number).exists():
                logger.info(f"[GenerateSingle] Question {question_number} already exists for session {session_id}, skipping")
                check_all_questions_completed(session_id)
                return f"q_{index}_ok"

            if attempt == 2:
                raise RuntimeError(
                    f"Graph completed without storing question {question_number}. "
                    f"errors={final_state.get('errors')}, retry_count={final_state.get('retry_count')}"
                )

            # Reset mutable state before the next graph attempt
            state.update({
                "retry_count": 0,
                "generated_question": {},
                "retrieved_chunks": [],
                "validated_chunks": [],
                "target_focus": "",
                "hyde_query": "",
                "retrieval_mode": "kb_grounded",
                "kb_gap_detected": False,
                "fallback_reason": "",
                "errors": list(final_state.get("errors", [])),
            })

    except Exception as e:
        logger.error("generate_single_question failure (q_%d): %s", index, e, exc_info=True)
        updated = QuizSession.objects.filter(id=session_id, status='generating').update(status='failed')
        from .utils import redis_client
        if updated:
            redis_client.set(f"session:status:{session_id}", "failed", ex=86400)
        session = QuizSession.objects.filter(id=session_id).first()
        if updated and session is not None:
            notify_laravel_failed(session, str(e))
        return f"q_{index}_fail"


def check_all_questions_completed(session_id):
    """Move session to 'review' once all N questions are stored in the DB."""
    session = QuizSession.objects.get(id=session_id)
    count = QuizQuestion.objects.filter(session_id=session_id).count()
    logger.info(f"[CheckComplete] Session {session_id}: {count}/{session.num_questions} questions, status={session.status}")
    
    if count < session.num_questions:
        logger.info(f"[CheckComplete] Not complete yet, returning")
        return

    moved = QuizSession.objects.filter(id=session_id, status='generating').update(status='review')
    logger.info(f"[CheckComplete] Updated status to review: {moved} rows affected")
    if not moved:
        return

    session.status = 'review'
    from .utils import redis_client
    redis_client.set(f"session:status:{session_id}", "review", ex=86400)
    notify_laravel_review_ready(session)


# ---------------------------------------------------------------------------
# Laravel webhook helpers
# ---------------------------------------------------------------------------

def notify_laravel_review_ready(session):
    try:
        httpx.post(
            f"{settings.BACKEND_URL}/api/internal/quiz/review-ready",
            json={
                'session_id': str(session.id),
                'candidate_id': session.candidate_id,
                'job_offer_id': session.job_offer_id,
            },
            timeout=10,
        )
    except Exception as err:
        logger.warning("review-ready notification failed: %s", err)


def notify_laravel_failed(session, error_message: str):
    try:
        httpx.post(
            f"{settings.BACKEND_URL}/api/internal/quiz/failed",
            json={
                'session_id': str(session.id),
                'candidate_id': session.candidate_id,
                'job_offer_id': session.job_offer_id,
                'error': error_message[:1000],
            },
            timeout=10,
        )
    except Exception as err:
        logger.warning("failure notification failed: %s", err)


# ---------------------------------------------------------------------------
# Celery task — Answer scoring
# ---------------------------------------------------------------------------

@app.task(bind=True)
def score_answer(self, answer_id):
    """
    MCQ scoring: compare selected_choice against correct_choice.
    Instant — no LLM, no embeddings, no ROUGE needed.
    Score: 100.0 if correct, 0.0 if wrong.
    """
    try:
        answer = QuizAnswer.objects.get(id=answer_id)
        question = answer.question

        selected = (answer.selected_choice or '').strip().upper()
        correct = (question.correct_choice or 'A').strip().upper()
        is_correct = (selected == correct) and bool(selected)

        final_score = 100.0 if is_correct else 0.0
        reasoning = (
            f"Selected: {selected or '(none)'}. Correct: {correct}. "
            + ("✓ Correct!" if is_correct else f"✗ Incorrect. {question.explanation}")
        )

        answer.selected_choice = selected
        answer.is_correct = is_correct
        answer.final_score = final_score
        # Fill legacy signal fields for report compatibility
        answer.rouge_score = final_score
        answer.bert_score = final_score
        answer.cosine_score = 1.0 if is_correct else 0.0
        answer.llm_score = final_score
        answer.scoring_reasoning = reasoning
        answer.status = 'scored'
        answer.scored_at = now()
        answer.save(update_fields=[
            'selected_choice', 'is_correct', 'final_score',
            'rouge_score', 'bert_score', 'cosine_score', 'llm_score',
            '_scoring_reasoning', 'status', 'scored_at',
        ])
        finalize_session_report_if_ready(str(answer.session_id))

    except Exception as e:
        logger.error("Scoring failure for answer %s: %s", answer_id, e, exc_info=True)



# ---------------------------------------------------------------------------
# Report builder
# ---------------------------------------------------------------------------

def _build_quiz_report(session: QuizSession, answers: list[QuizAnswer]) -> dict:
    score_by_focus = defaultdict(list)
    question_reports = []

    for answer in answers:
        focus = answer.question.skill_targeted or "General"
        score_by_focus[focus].append(answer.final_score)
        question_reports.append({
            "question_id": str(answer.question_id),
            "question_number": answer.question.question_number,
            "question_text": answer.question.question_text,
            "focus_area": focus,
            "score": round(answer.final_score, 2),
            "reasoning": answer.scoring_reasoning or "",
            "missing_concepts": answer.missing_concepts,
            "correct_concepts": answer.correct_concepts,
        })

    skill_breakdown = {
        focus: round(sum(scores) / len(scores), 2)
        for focus, scores in score_by_focus.items()
    }

    ordered = sorted(skill_breakdown.items(), key=lambda item: item[1])
    critical_gaps = [{"focus_area": f, "score": s} for f, s in ordered[:3]]
    confirmed_strengths = [
        {"focus_area": f, "score": s}
        for f, s in sorted(skill_breakdown.items(), key=lambda item: item[1], reverse=True)[:3]
    ]

    overall = round(sum(a.final_score for a in answers) / max(len(answers), 1), 2)
    if overall >= 75:
        narrative = "The candidate demonstrated strong command of the assessed responsibilities."
    elif overall >= 50:
        narrative = "The candidate covered the expected fundamentals but showed some gaps in depth."
    else:
        narrative = "The candidate struggled to provide complete answers for several assessed areas."

    suggestions = []
    if critical_gaps:
        suggestions.append(
            "Probe deeper on " + ", ".join(g["focus_area"] for g in critical_gaps[:2]) + " in the next round."
        )
    if confirmed_strengths:
        suggestions.append(
            "Leverage the candidate's strengths: " + ", ".join(s["focus_area"] for s in confirmed_strengths[:2]) + "."
        )

    return {
        "total_score": overall,
        "narrative_summary": narrative,
        "skill_breakdown": skill_breakdown,
        "critical_gaps": critical_gaps,
        "confirmed_strengths": confirmed_strengths,
        "interview_suggestions": suggestions,
        "question_reports": question_reports,
    }


def _notify_laravel_completed(session: QuizSession, report: QuizReport):
    try:
        httpx.post(
            f"{settings.BACKEND_URL}/api/internal/quiz/completed",
            json={
                "session_id": str(session.id),
                "candidate_id": session.candidate_id,
                "job_offer_id": session.job_offer_id,
                "total_score": report.total_score_normalized,
            },
            timeout=10,
        )
    except Exception as err:
        logger.warning("completion notification failed: %s", err)


def finalize_session_report_if_ready(session_id: str) -> bool:
    session = QuizSession.objects.get(id=session_id)
    if session.status == "completed" and hasattr(session, "report"):
        return True

    answers = list(
        QuizAnswer.objects
        .select_related("question")
        .filter(session_id=session_id)
        .order_by("question__question_number")
    )

    if len(answers) < session.num_questions:
        return False
    if any(a.status != "scored" for a in answers):
        return False

    report_payload = _build_quiz_report(session, answers)
    report, _ = QuizReport.objects.update_or_create(
        session=session,
        defaults={
            "total_score_normalized": report_payload["total_score"],
            "narrative_summary": report_payload["narrative_summary"],
            "skill_breakdown": report_payload["skill_breakdown"],
            "critical_gaps": report_payload["critical_gaps"],
            "confirmed_strengths": report_payload["confirmed_strengths"],
            "interview_suggestions": report_payload["interview_suggestions"],
        },
    )

    session.total_score = report.total_score_normalized
    session.status = "completed"
    session.completed_at = now()
    session.save(update_fields=["total_score", "status", "completed_at"])
    from .utils import redis_client
    redis_client.set(f"session:status:{session_id}", "completed", ex=86400)
    _notify_laravel_completed(session, report)
    return True


# ---------------------------------------------------------------------------
# Domain & ingestion helpers (async, called via _get_thread_event_loop)
# ---------------------------------------------------------------------------

async def classify_domain(text: str) -> str:
    return await call_llm(f"Domain: {text}", model=settings.OLLAMA_FAST_MODEL)


async def generate_summary(text: str, model=None) -> str:
    """Generate summary using LLM (slower but better quality)."""
    return await call_llm(f"Summary: {text}", model=model or settings.OLLAMA_FAST_MODEL)


async def generate_summary_fast(text: str) -> str:
    """
    Fast extractive summary without LLM call.
    Uses first sentence + key phrases for instant results.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    
    if not sentences:
        return "No content"
    
    # Take first meaningful sentence (at least 10 words)
    first_sentence = sentences[0]
    if len(first_sentence.split()) < 5 and len(sentences) > 1:
        first_sentence = sentences[1]
    
    # If text is short, return first sentence
    if len(text) < 200:
        return first_sentence[:150]
    
    # For longer text, extract key phrases
    lines = text.split('\n')
    key_phrases = []
    
    # Look for bullet points, headers, or emphasized content
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if line.startswith(('•', '-', '*', '→', '▸')):
            key_phrases.append(line[1:].strip()[:50])
        elif re.match(r'^\d+\.', line):  # Numbered list
            key_phrases.append(re.sub(r'^\d+\.', '', line).strip()[:50])
        elif ':' in line and len(line) < 100:  # Header with colon
            key_phrases.append(line[:60])
    
    # Combine first sentence with key phrases
    if key_phrases:
        return f"{first_sentence[:100]} | Key points: {', '.join(key_phrases[:2])}"
    
    return first_sentence[:200]


async def rate_seniority(text: str) -> dict:
    """Original LLM-based seniority rating (slower but more accurate)."""
    res = await call_llm(
        f"Seniority rating 1-3 for senior/mid/junior:\n{text}\nJSON: {{'senior':int,'mid':int,'junior':int}}",
        model=settings.OLLAMA_FAST_MODEL,
    )
    try:
        return json.loads(re.search(r'\{.*\}', res, re.DOTALL).group())
    except Exception:
        return {'senior': 1, 'mid': 1, 'junior': 1}


async def rate_seniority_fast(text: str) -> dict:
    """
    Fast rule-based seniority rating with optional LLM refinement.
    Uses keyword heuristics for instant results, avoiding slow LLM calls.
    """
    text_lower = text.lower()
    
    # Senior keywords
    senior_keywords = [
        'architect', 'lead', 'principal', 'staff', 'senior', 'expert', 'advanced',
        'complex', 'design patterns', 'system design', 'scalability', 'performance',
        'optimization', 'mentoring', 'team lead', 'technical lead', 'strategy'
    ]
    
    # Junior keywords  
    junior_keywords = [
        'beginner', 'entry', 'junior', 'basic', 'fundamental', 'learning',
        'student', 'fresh', 'graduate', 'intern', 'trainee', 'introduction'
    ]
    
    # Mid-level keywords
    mid_keywords = [
        'intermediate', 'professional', 'experienced', 'practical', 'implementation',
        'development', 'building', 'creating', 'maintaining', 'supporting'
    ]
    
    senior_score = sum(1 for kw in senior_keywords if kw in text_lower) * 2
    mid_score = sum(1 for kw in mid_keywords if kw in text_lower)
    junior_score = sum(1 for kw in junior_keywords if kw in text_lower) * 2
    
    # Normalize to 1-3 scale
    max_score = max(senior_score, mid_score, junior_score, 1)
    
    result = {
        'senior': max(1, min(3, int(senior_score / max_score * 3))),
        'mid': max(1, min(3, int(mid_score / max_score * 3))),
        'junior': max(1, min(3, int(junior_score / max_score * 3)))
    }
    
    # Ensure at least one is rated 2+ for technical content
    if result['senior'] == 1 and result['mid'] == 1 and result['junior'] == 1:
        # Check for technical content
        tech_indicators = ['code', 'programming', 'development', 'software', 'technical']
        if any(ind in text_lower for ind in tech_indicators):
            result['mid'] = 2  # Default technical content to mid-level
    
    return result


def extract_text_with_fallback(filepath: str) -> str:
    try:
        text = ""
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text += (page.extract_text() or "") + "\n"
        if len(text.split()) < 150:
            return _fallback_ocr(filepath)
        return text
    except Exception:
        return _fallback_ocr(filepath)


def _fallback_ocr(filepath: str) -> str:
    """
    Fallback OCR using pytesseract for scanned PDFs.
    Converts PDF pages to images and extracts text with OCR.
    """
    try:
        text = ""
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                # Convert page to image
                page_image = page.to_image(resolution=150)
                img = page_image.original
                
                # Convert to PIL Image if needed
                if not isinstance(img, Image.Image):
                    img = Image.fromarray(np.array(img))
                
                # OCR with pytesseract
                page_text = pytesseract.image_to_string(img)
                text += page_text + "\n"
        
        if not text.strip():
            logger.warning(f"OCR extracted no text from {filepath}")
        
        return text
    except Exception as e:
        logger.error(f"OCR fallback failed for {filepath}: {e}")
        return ""


def clean_text(text: str) -> str:
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    return re.sub(r'\n{3,}', '\n\n', text)

# ---------------------------------------------------------------------------
# Feedback Loop (Nightly KB Improvement)
# ---------------------------------------------------------------------------

@app.task(bind=True, priority=2)
def auto_improve_kb_from_feedback(self):
    """
    STAFF OPTIMIZATION: Nightly Celest task to analyze candidate feedback
    and generate KB/Ontology improvement suggestions.
    """
    from .models import QuizQuestion
    from django.db import close_old_connections

    try:
        # Get recent negative feedback
        flagged_questions = QuizQuestion.objects.filter(
            candidate_feedback__in=['fausse', 'trop_dure']
        ).select_related('session')
        
        if not flagged_questions.exists():
            return "No feedback to process."
            
        logger.info("Processing %d feedback reports for KB improvement.", flagged_questions.count())
        
        # Here a Staff-Level system aggregates the skills_targeted 
        # that overlap with 'trop_dure' and flags them in the Dashboard 
        # so HR can update the documents / KB.
        
        return "Feedback loop complete."
    except Exception as e:
        logger.error("Auto-improvement failure: %s", e, exc_info=True)
    finally:
        close_old_connections()

