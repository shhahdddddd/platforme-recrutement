<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ManualQuiz;
use App\Models\ManualQuizQuestion;
use App\Models\ManualQuizAnswer;
use App\Services\CompanyRealtimeNotificationService;
use App\Services\SubscriptionFeatureService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response as HttpResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class QuizController extends Controller
{
    public function __construct(
        private CompanyRealtimeNotificationService $notificationService,
        private SubscriptionFeatureService $subscriptionFeatureService
    ) {
    }

    public function notifyReviewReady(Request $request)
    {
        $payload = $request->validate([
            'session_id' => 'required|string',
            'candidate_id' => 'required|integer',
            'job_offer_id' => 'required|integer',
        ]);

        $application = $this->resolveApplicationForAiCallback(
            $payload['session_id'],
            $payload['candidate_id'],
            $payload['job_offer_id']
        );

        if (!$application) {
            return response()->json(['message' => 'Stale callback ignored'], 202);
        }

        $application->ai_quiz_session_id = $payload['session_id'];
        $application->ai_quiz_status = 'review';
        $application->ai_quiz_error = null;
        $application->save();

        if ($application->jobOffer) {
            $this->notificationService->notifyQuizDraftReady($application->jobOffer, (int) $application->id);
        }

        return response()->json(['message' => 'Quiz review status stored']);
    }

    public function notifyQuizFailed(Request $request)
    {
        $payload = $request->validate([
            'session_id' => 'required|string',
            'candidate_id' => 'required|integer',
            'job_offer_id' => 'required|integer',
            'error' => 'nullable|string',
        ]);

        $application = $this->resolveApplicationForAiCallback(
            $payload['session_id'],
            $payload['candidate_id'],
            $payload['job_offer_id']
        );

        if (!$application) {
            return response()->json(['message' => 'Stale callback ignored'], 202);
        }

        $application->ai_quiz_session_id = $payload['session_id'];
        $application->ai_quiz_status = 'failed';
        $application->ai_quiz_error = $payload['error'] ?? 'Quiz generation failed.';
        $application->save();

        return response()->json(['message' => 'Quiz failure stored']);
    }

    public function notifyQuizCompleted(Request $request)
    {
        $payload = $request->validate([
            'session_id' => 'required|string',
            'candidate_id' => 'required|integer',
            'job_offer_id' => 'required|integer',
            'total_score' => 'nullable|numeric',
        ]);

        $application = $this->resolveApplicationForAiCallback(
            $payload['session_id'],
            $payload['candidate_id'],
            $payload['job_offer_id']
        );

        if (!$application) {
            return response()->json(['message' => 'Stale callback ignored'], 202);
        }

        $score = isset($payload['total_score']) ? (float) $payload['total_score'] : null;
        $this->syncApplicationQuizState($application, 'completed', $score);

        if ($application->jobOffer && $application->candidate && $score !== null) {
            // Notify the candidate
            $this->notificationService->notifyQuizCompletedToCandidate(
                $application->jobOffer,
                $application->candidate,
                (int) $application->id,
                $score
            );
            
            // Notify the recruiter who initiated the quiz
            $recruiter = $application->jobOffer->recruiter ?? null;
            if ($recruiter) {
                $this->notificationService->notifyQuizCompletedToRecruiter(
                    $application->jobOffer,
                    $application->candidate,
                    $recruiter,
                    (int) $application->id,
                    $score,
                    true // isAiQuiz
                );
            }
        }

        return response()->json(['message' => 'Quiz completion stored']);
    }

    public function startQuiz(Request $request, $id)
    {
        $application = Application::with([
            'candidate.user',
            'jobOffer.company',
        ])->findOrFail($id);

        $candidate = $application->candidate;
        $jobOffer = $application->jobOffer;

        if (!$candidate || !$jobOffer) {
            Log::warning('Start quiz aborted because application relations are incomplete', [
                'application_id' => $id,
                'has_candidate' => (bool) $candidate,
                'has_job_offer' => (bool) $jobOffer,
            ]);

            return response()->json([
                'error' => 'This application is missing candidate or job offer data.',
            ], 422);
        }

        if (!$this->userCanManageApplication($request, $application)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Only Recruiters can launch AI quizzes, not RH (Company Admin)
        $user = $request->user();
        if (!$user->isRecruiter()) {
            return response()->json(['error' => 'Only recruiters can initiate automated assessments.'], 403);
        }

        // Check if company has AI features enabled in their subscription
        $company = $jobOffer->company;
        if ($company && !$this->subscriptionFeatureService->hasAiQuiz($company)) {
            return response()->json([
                'error' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('ai_quiz'),
            ], 403);
        }

        // Only block if AI quiz is already completed (allow both manual and AI quiz)
        if ($application->ai_quiz_status === 'completed') {
            return response()->json(['error' => 'The AI assessment for this candidate has already been completed.'], 422);
        }

        $validated = $request->validate([
            'num_questions' => 'integer|min:5|max:15',
            'difficulty' => 'string|in:easy,medium,hard,mixed',
            'time_limit' => 'nullable|integer|min:5|max:120',
        ]);

        $offerType = strtolower($jobOffer->offer_type ?? 'job');
        $descriptionSnippet = mb_substr($jobOffer->description ?? '', 0, 1200);

        try {
            $response = $this->forwardAiRequest(
                'post',
                '/api/quiz/launch/',
                [
                    'candidate_id' => $candidate->id,
                    'job_offer_id' => $jobOffer->id,
                    'company_id' => $jobOffer->company_id,
                    'hr_initiator_id' => $request->user()?->id ?? auth()->id(),
                    'num_questions' => $validated['num_questions'] ?? 8,
                    'difficulty' => $validated['difficulty'] ?? 'mixed',
                    'time_limit' => $validated['time_limit'] ?? null,
                    'job_title' => $jobOffer->title,
                    'job_description' => $descriptionSnippet,
                    'offer_type' => $offerType,
                    'seniority_level' => $jobOffer->seniority_level,
                ]
            );
        } catch (ConnectionException $e) {
            Log::error('AI Microservice unreachable: ' . $e->getMessage());
            return response()->json(['error' => 'AI service is currently unavailable.'], 503);
        } catch (\Throwable $e) {
            Log::error('Start Quiz Error: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
        }

        if (!$response->successful()) {
            Log::error('AI Microservice error on start-quiz', [
                'status' => $response->status(),
                'body' => $response->body(),
                'application' => $id,
            ]);

            return response()->json([
                'error' => $this->extractAiError($response, 'AI Microservice returned an error. Please try again.'),
            ], $this->proxyAiStatus($response));
        }

        $sessionPayload = $response->json();
        $returnedSessionId = $sessionPayload['session_id'] ?? $application->ai_quiz_session_id;
        $returnedStatus = $sessionPayload['status'] ?? 'generating';
        $isNewSession = $returnedSessionId !== $application->ai_quiz_session_id || $returnedStatus === 'generating';

        $application->ai_quiz_session_id = $returnedSessionId;
        $application->ai_quiz_status = $returnedStatus;
        $application->ai_quiz_error = null;
        if ($isNewSession) {
            $application->ai_quiz_score = null;
            $application->ai_quiz_sent_at = null;
            $application->ai_quiz_completed_at = null;
        }
        $application->save();

        $firstName = $candidate->first_name
            ?? $candidate->user->first_name
            ?? 'The candidate';

        return response()->json([
            'success' => true,
            'message' => $sessionPayload['message']
                ?? "{$firstName}'s assessment is being generated and will be ready for review shortly.",
            'session' => $sessionPayload,
        ]);
    }

    public function showQuiz(Request $request, $id)
    {
        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz session exists for this application.'], 404);
        }

        $response = $this->forwardAiRequest('get', "/api/quiz/{$application->ai_quiz_session_id}/review/");
        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to load quiz draft.')],
                $this->proxyAiStatus($response)
            );
        }

        $payload = $response->json();
        $sessionStatus = data_get($payload, 'session.status');
        if ($sessionStatus) {
            $this->syncApplicationQuizState($application, $sessionStatus);
        }
        $payload = $this->augmentApplicationPayload($application, $payload);

        return response()->json(['success' => true, 'data' => $payload]);
    }

    public function updateQuizQuestion(Request $request, $id, $questionId)
    {
        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz session exists for this application.'], 404);
        }

        $validated = $request->validate([
            'question_text' => 'nullable|string',
            'text' => 'nullable|string',
            'reference_answer' => 'nullable|string',
            'ref' => 'nullable|string',
            'follow_up_hint' => 'nullable|string',
            'estimated_answer_length' => 'nullable|integer|min:20|max:1000',
            'difficulty' => 'nullable|string|in:easy,medium,hard',
            'hr_approved' => 'nullable|boolean',
            'choices' => 'nullable|array',
            'choices.*' => 'string',
            'correct_choice' => 'nullable|string|in:A,B,C,D',
            'explanation' => 'nullable|string',
        ]);

        if (empty($validated)) {
            return response()->json(['error' => 'No editable fields were provided.'], 422);
        }

        $response = $this->forwardAiRequest(
            'patch',
            "/api/quiz/question/{$questionId}/edit/",
            $validated
        );

        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to update question.')],
                $this->proxyAiStatus($response)
            );
        }

        return response()->json(['success' => true, 'data' => $response->json()]);
    }

    public function reorderQuiz(Request $request, $id)
    {
        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz session exists for this application.'], 404);
        }

        $validated = $request->validate([
            'question_ids' => 'required|array|min:1',
            'question_ids.*' => 'required|string',
        ]);

        $response = $this->forwardAiRequest(
            'post',
            "/api/quiz/{$application->ai_quiz_session_id}/reorder/",
            ['question_ids' => $validated['question_ids']]
        );

        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to reorder questions.')],
                $this->proxyAiStatus($response)
            );
        }

        return response()->json(['success' => true, 'data' => $response->json()]);
    }

    public function regenerateQuizQuestion(Request $request, $id, $questionId)
    {
        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz session exists for this application.'], 404);
        }

        $response = $this->forwardAiRequest(
            'post',
            "/api/quiz/question/{$questionId}/regenerate/"
        );

        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to regenerate the question.')],
                $this->proxyAiStatus($response)
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Question regeneration started.',
            'data' => $response->json(),
        ]);
    }

    public function deleteQuizQuestion(Request $request, $id, $questionId)
    {
        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz session exists for this application.'], 404);
        }

        $response = $this->forwardAiRequest(
            'delete',
            "/api/quiz/question/{$questionId}/edit/"
        );

        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to remove question.')],
                $this->proxyAiStatus($response)
            );
        }

        return response()->json(['success' => true, 'message' => 'Question removed.']);
    }

    public function sendQuiz(Request $request, $id)
    {
        Log::info('sendQuiz: Starting quiz send process', ['application_id' => $id]);

        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            Log::warning('sendQuiz: Application not found or unauthorized', ['application_id' => $id]);
            return $application;
        }

        if (!$application->ai_quiz_session_id) {
            Log::warning('sendQuiz: No quiz session exists', ['application_id' => $id]);
            return response()->json(['error' => 'No quiz session exists for this application.'], 404);
        }

        Log::info('sendQuiz: Calling AI finalize', ['application_id' => $id, 'session_id' => $application->ai_quiz_session_id]);

        $response = $this->forwardAiRequest('post', "/api/quiz/{$application->ai_quiz_session_id}/finalize/");
        if (!$response->successful()) {
            Log::error('sendQuiz: AI finalize failed', ['application_id' => $id, 'status' => $response->status()]);
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to send quiz.')],
                $this->proxyAiStatus($response)
            );
        }

        Log::info('sendQuiz: AI finalize successful, updating application', ['application_id' => $id]);

        $this->syncApplicationQuizState($application, 'ready');
        $application->ai_quiz_sent_at = now();
        $application->save();

        $aiPayload = $response->json();
        $deadline = data_get($aiPayload, 'deadline') ?? data_get($aiPayload, 'session.deadline');

        Log::info('sendQuiz: Checking notification prerequisites', [
            'application_id' => $id,
            'has_job_offer' => $application->jobOffer ? true : false,
            'has_candidate' => $application->candidate ? true : false,
        ]);

        if ($application->jobOffer && $application->candidate) {
            Log::info('sendQuiz: Calling notification service', ['application_id' => $id]);
            $this->notificationService->notifyQuizReadyToCandidate(
                $application->jobOffer,
                $application->candidate,
                (int) $application->id,
                (string) $application->ai_quiz_session_id,
                is_string($deadline) ? $deadline : null,
                'ai' // AI quiz type
            );
            Log::info('sendQuiz: Notification service called', ['application_id' => $id]);
        } else {
            Log::warning('sendQuiz: Cannot notify - missing jobOffer or candidate', [
                'application_id' => $id,
                'has_job_offer' => $application->jobOffer ? true : false,
                'has_candidate' => $application->candidate ? true : false,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Quiz sent to the candidate.',
            'data' => $aiPayload,
        ]);
    }

    public function showQuizReport(Request $request, $id)
    {
        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        // 1. Manual Quiz Report
        if ($application->manualQuiz) {
            $quiz = $application->manualQuiz->load(['questions', 'answers']);
            if ($this->manualQuizHasExpired($quiz) && $this->resolveManualQuizStatus($application, $quiz) !== 'completed') {
                $this->finalizeManualQuiz($application, $quiz);
                $quiz = $quiz->fresh(['questions', 'answers']);
            }
            $report = $this->manualQuizReportPayload($application, $quiz);

            return response()->json([
                'success' => true,
                'data' => [
                    'session' => $this->manualQuizSessionPayload($application, $quiz),
                    'application' => $this->manualQuizApplicationPayload($application, $quiz),
                    'report' => $report,
                    'questions' => $this->manualQuizQuestionsPayload($quiz),
                ],
            ]);
        }

        // 2. AI Quiz Report
        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz session exists for this application.'], 404);
        }

        $response = $this->forwardAiRequest('get', "/api/quiz/{$application->ai_quiz_session_id}/report/");
        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to load quiz report.')],
                $this->proxyAiStatus($response)
            );
        }

        $payload = $response->json();
        $sessionStatus = data_get($payload, 'session.status');
        $score = data_get($payload, 'report.total_score');
        if ($sessionStatus) {
            $this->syncApplicationQuizState($application, $sessionStatus, $score !== null ? (float) $score : null);
        }
        $payload = $this->augmentApplicationPayload($application, $payload);

        return response()->json(['success' => true, 'data' => $payload]);
    }

    public function candidateQuiz(Request $request, $id)
    {
        $application = $this->candidateApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        // Allow explicit request for AI quiz (e.g., from AI quiz notification)
        $preferAi = $request->query('prefer_ai') === '1' || $request->query('type') === 'ai';

        // 1. Check for AI Quiz first if explicitly requested
        if ($preferAi && $application->ai_quiz_session_id) {
            try {
                Log::info('Fetching AI quiz for application', [
                    'application_id' => $application->id,
                    'ai_quiz_session_id' => $application->ai_quiz_session_id,
                ]);
                
                $response = $this->forwardAiRequest('get', "/api/quiz/{$application->ai_quiz_session_id}/candidate/");
                
                Log::info('AI microservice response', [
                    'status' => $response->status(),
                    'successful' => $response->successful(),
                ]);
                
                if (!$response->successful()) {
                    return response()->json(
                        ['error' => $this->extractAiError($response, 'Unable to load quiz.')],
                        $this->proxyAiStatus($response)
                    );
                }

                $payload = $response->json();
                $sessionStatus = data_get($payload, 'session.status');
                $score = data_get($payload, 'report.total_score');
                if ($sessionStatus) {
                    $this->syncApplicationQuizState($application, $sessionStatus, $score !== null ? (float) $score : null);
                }
                $payload = $this->augmentApplicationPayload($application, $payload);

                return response()->json(['success' => true, 'data' => $payload]);
            } catch (\Exception $e) {
                Log::error('Error fetching AI quiz', [
                    'application_id' => $application->id,
                    'ai_quiz_session_id' => $application->ai_quiz_session_id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                return response()->json(
                    ['error' => 'Failed to load AI quiz. Please try again later.'],
                    500
                );
            }
        }

        // 2. Check for Manual Quiz (Recruiter-created)
        if ($application->manualQuiz) {
            $quiz = $application->manualQuiz->load(['questions', 'answers']);
            if ($this->manualQuizHasExpired($quiz) && $this->resolveManualQuizStatus($application, $quiz) !== 'completed') {
                $this->finalizeManualQuiz($application, $quiz);
                $quiz = $quiz->fresh(['questions', 'answers']);
            }
            $status = $this->resolveManualQuizStatus($application, $quiz);
            $payload = [
                'session' => $this->manualQuizSessionPayload($application, $quiz),
                'application' => $this->manualQuizApplicationPayload($application, $quiz),
                'questions' => $this->manualQuizQuestionsPayload($quiz, $status !== 'completed'),
            ];
            if ($status === 'completed' || $application->manual_quiz_score !== null) {
                $payload['report'] = $this->manualQuizReportPayload($application, $quiz);
            }

            return response()->json([
                'success' => true,
                'data' => $payload,
            ]);
        }

        // 3. Fallback to AI Quiz
        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz is attached to this application.'], 404);
        }

        $response = $this->forwardAiRequest('get', "/api/quiz/{$application->ai_quiz_session_id}/candidate/");
        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to load quiz.')],
                $this->proxyAiStatus($response)
            );
        }

        $payload = $response->json();
        $sessionStatus = data_get($payload, 'session.status');
        $score = data_get($payload, 'report.total_score');
        if ($sessionStatus) {
            $this->syncApplicationQuizState($application, $sessionStatus, $score !== null ? (float) $score : null);
        }
        $payload = $this->augmentApplicationPayload($application, $payload);

        return response()->json(['success' => true, 'data' => $payload]);
    }

    public function candidateStartQuiz(Request $request, $id)
    {
        $application = $this->candidateApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        // Allow explicit request for AI quiz (e.g., from AI quiz notification)
        $preferAi = $request->query('prefer_ai') === '1' || $request->query('type') === 'ai';

        // 1. AI Quiz (if explicitly requested and available)
        if ($preferAi && $application->ai_quiz_session_id) {
            $response = $this->forwardAiRequest('post', "/api/quiz/{$application->ai_quiz_session_id}/candidate/");
            if (!$response->successful()) {
                return response()->json(
                    ['error' => $this->extractAiError($response, 'Unable to start quiz.')],
                    $this->proxyAiStatus($response)
                );
            }

            $this->syncApplicationQuizState($application, 'in_progress');
            return response()->json(['success' => true, 'data' => $response->json()]);
        }

        // 2. Manual Quiz
        if ($application->manualQuiz) {
            $quiz = $application->manualQuiz->fresh();
            if ($this->resolveManualQuizStatus($application, $quiz) === 'completed') {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'session_id' => "manual-{$quiz->id}",
                        'status' => 'completed',
                        'session' => [
                            'status' => 'completed',
                            'deadline' => $this->manualQuizDeadline($quiz)?->toIso8601String(),
                            'remaining_seconds' => 0,
                        ],
                    ],
                ]);
            }
            if ($this->manualQuizHasExpired($quiz)) {
                $this->finalizeManualQuiz($application, $quiz);
                return response()->json([
                    'success' => true,
                    'data' => [
                        'session_id' => "manual-{$quiz->id}",
                        'status' => 'completed',
                        'session' => [
                            'status' => 'completed',
                            'deadline' => $this->manualQuizDeadline($quiz)?->toIso8601String(),
                            'remaining_seconds' => 0,
                        ],
                    ],
                ]);
            }

            if (!$quiz->started_at) {
                $quiz->started_at = now();
            }
            $quiz->status = 'in_progress';
            $quiz->save();
            $application->update(['manual_quiz_status' => 'in_progress']);
            return response()->json([
                'success' => true,
                'data' => [
                    'session_id' => "manual-{$quiz->id}",
                    'status' => 'in_progress',
                    'session' => [
                        'status' => 'in_progress',
                        'started_at' => $quiz->started_at?->toIso8601String(),
                        'deadline' => $this->manualQuizDeadline($quiz)?->toIso8601String(),
                        'remaining_seconds' => $this->manualQuizRemainingSeconds($quiz),
                    ],
                ],
            ]);
        }

        // 3. Fallback to AI Quiz
        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz is attached to this application.'], 404);
        }

        $response = $this->forwardAiRequest('post', "/api/quiz/{$application->ai_quiz_session_id}/candidate/");
        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to start quiz.')],
                $this->proxyAiStatus($response)
            );
        }

        $this->syncApplicationQuizState($application, 'in_progress');
        return response()->json(['success' => true, 'data' => $response->json()]);
    }

    public function submitCandidateAnswer(Request $request, $id, $questionId)
    {
        $application = $this->candidateApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        $validated = $request->validate([
            'answer' => 'nullable|string',
            'choice' => 'nullable|string',
        ]);

        $candidateAnswer = $validated['choice'] ?? $validated['answer'];
        if (!$candidateAnswer) {
            return response()->json(['error' => 'No answer provided.'], 422);
        }

        // 1. Check if this is a Manual Quiz Question first
        // Manual quiz questions use integer IDs, AI quiz questions use UUIDs
        $isManualQuestion = false;
        $isUuid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $questionId);
        
        if ($application->manualQuiz && !$isUuid) {
            $quiz = $application->manualQuiz;
            $manualQuestion = ManualQuizQuestion::where('manual_quiz_id', $quiz->id)
                ->where('id', $questionId)
                ->first();
            
            if ($manualQuestion) {
                $isManualQuestion = true;
                
                if ($this->manualQuizHasExpired($quiz)) {
                    $this->finalizeManualQuiz($application, $quiz);
                    return response()->json(['error' => 'The time limit for this assessment has been reached.'], 422);
                }

                $isCorrect = (strtoupper($candidateAnswer) === strtoupper($manualQuestion->correct_choice));

                ManualQuizAnswer::updateOrCreate(
                    ['manual_quiz_id' => $quiz->id, 'manual_quiz_question_id' => $manualQuestion->id],
                    ['selected_choice' => $candidateAnswer, 'is_correct' => $isCorrect]
                );

                $totalQuestions = $quiz->questions()->count();
                $totalAnswers = (int) $quiz->answers()
                    ->select('manual_quiz_question_id')
                    ->distinct()
                    ->count('manual_quiz_question_id');
                $allAnswered = $totalQuestions > 0 && $totalAnswers >= $totalQuestions;
                
                return response()->json([
                    'success' => true,
                    'is_correct' => $isCorrect,
                    'all_answered' => $allAnswered,
                ]);
            }
        }

        // 2. AI Quiz Submission (skip if this was a manual question)
        if (!$isManualQuestion) {
            $aiAnswer = $validated['answer'] ?? $validated['choice'];
            if (!$aiAnswer) {
                return response()->json(['error' => 'No answer provided.'], 422);
            }

            $response = $this->forwardAiRequest(
                'post',
                "/api/answers/{$questionId}/submit/",
                ['answer' => $aiAnswer]
            );

            if (!$response->successful()) {
                return response()->json(
                    ['error' => $this->extractAiError($response, 'Unable to submit answer.')],
                    $this->proxyAiStatus($response)
                );
            }

            $this->syncApplicationQuizState($application, 'in_progress');
            return response()->json(['success' => true, 'data' => $response->json()]);
        }
    }

    public function candidateSubmitQuiz(Request $request, $id)
    {
        $application = $this->candidateApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        if (!$application->manualQuiz) {
            return response()->json([
                'error' => 'This endpoint is only available for manual quizzes.',
            ], 422);
        }

        $quiz = $application->manualQuiz->load(['questions', 'answers']);
        if ($this->resolveManualQuizStatus($application, $quiz) === 'completed') {
            return response()->json([
                'success' => true,
                'message' => 'Assessment already submitted.',
                'data' => [
                    'is_manual' => true,
                    'status' => 'completed',
                    'score' => $application->manual_quiz_score,
                ],
            ]);
        }

        if ($this->manualQuizHasExpired($quiz)) {
            $score = $this->finalizeManualQuiz($application, $quiz->fresh(['questions', 'answers']));

            return response()->json([
                'success' => true,
                'message' => 'Assessment submitted successfully.',
                'data' => [
                    'is_manual' => true,
                    'status' => 'completed',
                    'score' => $score,
                ],
            ]);
        }

        $totalQuestions = (int) $quiz->questions->count();
        $answeredQuestions = (int) $quiz->answers
            ->pluck('manual_quiz_question_id')
            ->filter()
            ->unique()
            ->count();

        if ($totalQuestions <= 0) {
            return response()->json([
                'error' => 'No questions are configured for this assessment.',
            ], 422);
        }

        if ($answeredQuestions < $totalQuestions) {
            return response()->json([
                'error' => 'Please answer all questions before submitting the assessment.',
                'data' => [
                    'answers_submitted' => $answeredQuestions,
                    'total_questions' => $totalQuestions,
                ],
            ], 422);
        }

        $score = $this->finalizeManualQuiz($application, $quiz->fresh(['questions', 'answers']));

        return response()->json([
            'success' => true,
            'message' => 'Assessment submitted successfully.',
            'data' => [
                'is_manual' => true,
                'status' => 'completed',
                'score' => $score,
            ],
        ]);
    }

    public function candidateQuizReport(Request $request, $id)
    {
        $application = $this->candidateApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        // Allow explicit request for AI quiz report (e.g., from AI quiz session)
        $preferAi = $request->query('prefer_ai') === '1' || $request->query('type') === 'ai';

        // 1. AI Quiz Report (if explicitly requested and available)
        if ($preferAi && $application->ai_quiz_session_id) {
            $response = $this->forwardAiRequest('get', "/api/quiz/{$application->ai_quiz_session_id}/report/");
            if (!$response->successful()) {
                return response()->json(
                    ['error' => $this->extractAiError($response, 'Unable to load quiz report.')],
                    $this->proxyAiStatus($response)
                );
            }

            $payload = $response->json();
            $sessionStatus = data_get($payload, 'session.status');
            $score = data_get($payload, 'report.total_score');
            if ($sessionStatus) {
                $this->syncApplicationQuizState($application, $sessionStatus, $score !== null ? (float) $score : null);
            }
            $payload = $this->augmentApplicationPayload($application, $payload);

            return response()->json(['success' => true, 'data' => $payload]);
        }

        // 2. Manual Quiz Report
        if ($application->manualQuiz) {
            $quiz = $application->manualQuiz->load(['questions', 'answers']);
            if ($this->manualQuizHasExpired($quiz) && $this->resolveManualQuizStatus($application, $quiz) !== 'completed') {
                $this->finalizeManualQuiz($application, $quiz);
                $quiz = $quiz->fresh(['questions', 'answers']);
            }
            $this->resolveManualQuizStatus($application, $quiz);
            $report = $this->manualQuizReportPayload($application, $quiz);

            return response()->json([
                'success' => true,
                'data' => [
                    'session' => $this->manualQuizSessionPayload($application, $quiz),
                    'application' => $this->manualQuizApplicationPayload($application, $quiz),
                    'report' => $report,
                    'question_reports' => $report['question_reports'],
                ],
            ]);
        }

        // 2. AI Quiz Report
        if (!$application->ai_quiz_session_id) {
            return response()->json(['error' => 'No quiz is attached to this application.'], 404);
        }

        $response = $this->forwardAiRequest('get', "/api/quiz/{$application->ai_quiz_session_id}/report/");
        if (!$response->successful()) {
            return response()->json(
                ['error' => $this->extractAiError($response, 'Unable to load quiz report.')],
                $this->proxyAiStatus($response)
            );
        }

        $payload = $response->json();
        $sessionStatus = data_get($payload, 'session.status');
        $score = data_get($payload, 'report.total_score');
        if ($sessionStatus) {
            $this->syncApplicationQuizState($application, $sessionStatus, $score !== null ? (float) $score : null);
        }
        $payload = $this->augmentApplicationPayload($application, $payload);

        return response()->json(['success' => true, 'data' => $payload]);
    }

    private function managedApplicationOrResponse(Request $request, $id)
    {
        $application = Application::with(['candidate.user', 'jobOffer.company', 'jobOffer.recruiters'])
            ->find($id);

        if (!$application) {
            return response()->json(['error' => 'Application not found'], 404);
        }

        if (!$this->userCanManageApplication($request, $application)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return $application;
    }

    private function candidateApplicationOrResponse(Request $request, $id)
    {
        $application = Application::with(['candidate.user', 'jobOffer.company'])->find($id);
        if (!$application) {
            return response()->json(['error' => 'Application not found'], 404);
        }

        $candidate = $request->user()?->candidate;
        if (!$candidate || (int) $candidate->id !== (int) $application->candidate_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return $application;
    }

    private function userCanManageApplication(Request $request, Application $application): bool
    {
        $user = $request->user();
        if (!$user || !$application->jobOffer) {
            return false;
        }

        if ($user->company && (int) $user->company->id === (int) $application->jobOffer->company_id) {
            return true;
        }

        if ($user->isRecruiter() && $user->recruiter) {
            return (int) $user->recruiter->company_id === (int) $application->jobOffer->company_id;
        }

        return false;
    }

    private function resolveApplicationForAiCallback(string $sessionId, int $candidateId, int $jobOfferId): ?Application
    {
        $application = Application::with(['candidate.user', 'jobOffer.company'])
            ->where('candidate_id', $candidateId)
            ->where('job_offer_id', $jobOfferId)
            ->orderByDesc('applied_at')
            ->first();

        if (!$application) {
            return null;
        }

        $currentSessionId = $application->ai_quiz_session_id;
        if ($currentSessionId && $currentSessionId !== $sessionId) {
            Log::info('Ignoring stale AI quiz callback', [
                'application_id' => $application->id,
                'current_session_id' => $currentSessionId,
                'callback_session_id' => $sessionId,
            ]);
            return null;
        }

        return $application;
    }

    private function syncApplicationQuizState(Application $application, ?string $status, ?float $score = null): void
    {
        if ($status !== null && $status !== '') {
            $application->ai_quiz_status = $status;
        }
        if ($score !== null) {
            $application->ai_quiz_score = $score;
        }
        if ($application->ai_quiz_status === 'completed' && !$application->ai_quiz_completed_at) {
            $application->ai_quiz_completed_at = now();
        }
        if (in_array($application->ai_quiz_status, ['review', 'ready', 'in_progress', 'completed'], true)) {
            $application->ai_quiz_error = null;
        } elseif ($application->ai_quiz_status === 'failed' && !$application->ai_quiz_error) {
            $application->ai_quiz_error = 'Quiz generation failed or timed out.';
        }
        $application->save();
    }

    private function manualQuizSessionPayload(Application $application, ManualQuiz $quiz): array
    {
        $deadline = $this->manualQuizDeadline($quiz);

        return [
            'id' => "manual-{$quiz->id}",
            'status' => $this->resolveManualQuizStatus($application, $quiz),
            'time_limit' => $quiz->time_limit,
            'created_at' => $quiz->created_at,
            'started_at' => $quiz->started_at?->toIso8601String(),
            'completed_at' => $quiz->completed_at?->toIso8601String(),
            'deadline' => $deadline?->toIso8601String(),
            'remaining_seconds' => $this->manualQuizRemainingSeconds($quiz),
            'is_manual' => true,
            'num_questions' => $quiz->questions->count(),
            'job_title' => $application->jobOffer?->title,
        ];
    }

    private function manualQuizApplicationPayload(Application $application, ManualQuiz $quiz): array
    {
        $status = $this->resolveManualQuizStatus($application, $quiz);
        $deadline = $this->manualQuizDeadline($quiz);

        return [
            'application_id' => (int) $application->id,
            'job_offer_id' => (int) $application->job_offer_id,
            'company_name' => $application->jobOffer?->company?->name,
            'company_logo' => $application->jobOffer?->company?->picture,
            'job_title' => $application->jobOffer?->title,
            'quiz_session_id' => "manual-{$quiz->id}",
            'quiz_status' => $status,
            'quiz_score' => $application->manual_quiz_score,
            'estimated_duration_minutes' => $quiz->time_limit,
            'time_limit_per_question' => null,
            'time_limit_minutes' => $quiz->time_limit,
            'started_at' => $quiz->started_at?->toIso8601String(),
            'complete_by' => $deadline?->toIso8601String(),
        ];
    }

    private function manualQuizQuestionsPayload(ManualQuiz $quiz, bool $hideAnswers = false)
    {
        return $quiz->questions->map(function ($q) use ($quiz, $hideAnswers) {
            $labels = ['A', 'B', 'C', 'D', 'E', 'F'];
            $labeledChoices = [];
            foreach ($q->choices as $i => $choice) {
                $label = null;
                if (is_string($i) && preg_match('/^[A-F]$/i', $i)) {
                    $label = strtoupper($i);
                } elseif (is_numeric($i) && isset($labels[(int) $i])) {
                    $label = $labels[(int) $i];
                }

                if (!$label) {
                    continue;
                }

                $choiceText = $choice;
                if (is_array($choiceText)) {
                    $choiceText = $choiceText['text'] ?? $choiceText['value'] ?? $choiceText['choice'] ?? '';
                }
                $choiceText = trim((string) $choiceText);
                if ($choiceText === '') {
                    continue;
                }

                $labeledChoices[] = ['label' => $label, 'text' => $choiceText];
            }

            $answer = $quiz->answers->where('manual_quiz_question_id', (int) $q->id)->first();

            return [
                'id' => $q->id,
                'question' => $q->question_text,
                'question_text' => $q->question_text,
                'question_number' => $q->question_number,
                'choices' => $q->choices,
                'choices_labeled' => $labeledChoices,
                'category' => $q->category,
                'points' => $q->points,
                'skill_targeted' => $q->category ?? 'Manual Assessment',
                'explanation' => $hideAnswers ? null : $q->explanation,
                'correct_choice' => $hideAnswers ? null : $q->correct_choice,
                'candidate_answer' => $answer,
                'answer_text' => $answer?->selected_choice,
                'selected_choice' => $answer?->selected_choice,
                'score' => $answer?->is_correct ? 1.0 : 0.0,
            ];
        });
    }

    private function manualQuizQuestionReportsPayload(ManualQuiz $quiz)
    {
        return $quiz->questions->map(function ($q) use ($quiz) {
            $answer = $quiz->answers->where('manual_quiz_question_id', (int) $q->id)->first();

            return [
                'id' => $q->id,
                'question_number' => $q->question_number,
                'question_text' => $q->question_text,
                'choices' => $q->choices,
                'correct_choice' => $q->correct_choice,
                'explanation' => $q->explanation,
                'reasoning' => $q->explanation,
                'focus_area' => $q->category ?? 'Manual Assessment',
                'skill_targeted' => $q->category ?? 'Manual Assessment',
                'answer_text' => $answer?->selected_choice,
                'score' => $answer?->is_correct ? 100 : 0,
            ];
        });
    }

    private function manualQuizReportPayload(Application $application, ManualQuiz $quiz): array
    {
        $score = $application->manual_quiz_score;
        $formattedScore = $score === null
            ? null
            : rtrim(rtrim(number_format((float) $score, 2, '.', ''), '0'), '.');

        return [
            'total_score' => $score,
            'narrative_summary' => $score === null
                ? 'The manual assessment has been submitted and is awaiting scoring.'
                : "You achieved a score of {$formattedScore}% on this manual assessment.",
            'question_reports' => $this->manualQuizQuestionReportsPayload($quiz),
            'critical_strengths' => [],
            'critical_gaps' => [],
        ];
    }

    private function manualQuizDeadline(ManualQuiz $quiz): ?Carbon
    {
        if (!$quiz->started_at || !$quiz->time_limit) {
            return null;
        }

        return $quiz->started_at->copy()->addMinutes((int) $quiz->time_limit);
    }

    private function manualQuizRemainingSeconds(ManualQuiz $quiz): ?int
    {
        $deadline = $this->manualQuizDeadline($quiz);
        if (!$deadline) {
            return null;
        }

        return max(0, Carbon::now()->diffInSeconds($deadline, false));
    }

    private function manualQuizHasExpired(ManualQuiz $quiz, int $gracePeriodSeconds = 5): bool
    {
        $deadline = $this->manualQuizDeadline($quiz);
        if (!$deadline) {
            return false;
        }

        // Add grace period to account for network latency between frontend timer and backend processing
        // This prevents false "time limit reached" errors when candidate submits with seconds remaining
        $deadlineWithGrace = $deadline->copy()->addSeconds($gracePeriodSeconds);

        return Carbon::now()->greaterThanOrEqualTo($deadlineWithGrace);
    }

    private function finalizeManualQuiz(Application $application, ManualQuiz $quiz): float
    {
        if (
            strtolower((string) $application->manual_quiz_status) === 'completed' &&
            $application->manual_quiz_score !== null
        ) {
            return (float) $application->manual_quiz_score;
        }

        $quiz->loadMissing([
            'questions',
            'answers',
            'recruiter.user',
            'application.jobOffer',
            'application.candidate.user',
        ]);

        $totalQuestions = $quiz->questions->count();
        $correctCount = $quiz->answers->where('is_correct', true)->count();
        $finalScore = $totalQuestions > 0
            ? round(($correctCount / $totalQuestions) * 100, 2)
            : 0.0;

        if (!$quiz->started_at) {
            $quiz->started_at = now();
        }
        $quiz->status = 'completed';
        $quiz->completed_at = $quiz->completed_at ?? now();
        $quiz->save();

        $application->manual_quiz_score = $finalScore;
        $application->manual_quiz_status = 'completed';
        $application->manual_quiz_completed_at = $application->manual_quiz_completed_at ?? $quiz->completed_at;
        $application->status = 'interview';
        $application->save();

        // Propagate results only to applications without an assigned manual quiz.
        // Applications with their own manual quiz should keep independent status.
        \App\Models\Application::where('candidate_id', $application->candidate_id)
            ->where('id', '!=', $application->id)
            ->whereNull('manual_quiz_score')
            ->whereDoesntHave('manualQuiz')
            ->update([
                'manual_quiz_score' => $finalScore,
                'manual_quiz_status' => 'completed',
                'manual_quiz_completed_at' => $application->manual_quiz_completed_at
            ]);

        if ($application->jobOffer && $application->candidate && $quiz->recruiter) {
            $this->notificationService->notifyQuizCompletedToRecruiter(
                $application->jobOffer,
                $application->candidate,
                $quiz->recruiter,
                (int) $application->id,
                $finalScore
            );
        }

        return $finalScore;
    }

    private function resolveManualQuizStatus(Application $application, ManualQuiz $quiz): string
    {
        $currentStatus = strtolower(trim((string) $application->manual_quiz_status));
        $quizStatus = strtolower(trim((string) $quiz->status));

        if ($application->manual_quiz_score !== null || $quizStatus === 'completed') {
            $resolvedStatus = 'completed';
        } elseif ($currentStatus === '' || $currentStatus === 'none') {
            $resolvedStatus = $quizStatus !== '' ? $quizStatus : 'ready';
        } else {
            $resolvedStatus = $currentStatus;
        }

        if ($resolvedStatus !== $application->manual_quiz_status) {
            $application->manual_quiz_status = $resolvedStatus;
            if ($resolvedStatus === 'completed' && !$application->manual_quiz_completed_at) {
                $application->manual_quiz_completed_at = now();
            }
            $application->save();
        }

        return $resolvedStatus;
    }

    private function augmentApplicationPayload(Application $application, array $payload): array
    {
        $sentAt = $application->ai_quiz_sent_at;
        $session = data_get($payload, 'session', []);
        $sessionDeadline = data_get($payload, 'session.deadline');
        $timeLimit = (int) ($session['time_limit'] ?? 0);
        $numQuestions = (int) ($session['num_questions'] ?? 0);

        // Calculate remaining seconds for AI quiz timer
        $remainingSeconds = null;
        if ($sessionDeadline) {
            try {
                $deadline = Carbon::parse($sessionDeadline);
                $remainingSeconds = max(0, Carbon::now()->diffInSeconds($deadline, false));
            } catch (\Exception $e) {
                $remainingSeconds = null;
            }
        }

        // Add remaining_seconds to session payload for frontend timer sync
        if (!isset($payload['session']['remaining_seconds'])) {
            $payload['session']['remaining_seconds'] = $remainingSeconds;
        }

        $payload['application'] = [
            'application_id' => (int) $application->id,
            'job_offer_id' => (int) $application->job_offer_id,
            'company_name' => $application->jobOffer?->company?->name,
            'company_logo' => $application->jobOffer?->company?->picture,
            'job_title' => $application->jobOffer?->title,
            'quiz_session_id' => $application->ai_quiz_session_id,
            'quiz_status' => $application->ai_quiz_status,
            'quiz_score' => $application->ai_quiz_score,
            'quiz_error' => $application->ai_quiz_error,
            'estimated_duration_minutes' => ($timeLimit > 0 && $numQuestions > 0) ? $timeLimit * $numQuestions : null,
            'time_limit_per_question' => $timeLimit > 0 ? $timeLimit : null,
            'sent_at' => $sentAt?->toIso8601String(),
            'complete_by' => $sessionDeadline ?: ($sentAt ? $sentAt->copy()->addHours(48)->toIso8601String() : null),
        ];

        return $payload;
    }

    private function forwardAiRequest(string $method, string $path, array $payload = []): HttpResponse
    {
        try {
            $client = Http::acceptJson()->timeout(30);
            $url = $this->aiBaseUrl() . $path;
            
            Log::info('Forwarding request to AI microservice', [
                'method' => $method,
                'url' => $url,
                'path' => $path,
            ]);

            $response = match (strtolower($method)) {
                'get' => $client->get($url, $payload),
                'patch' => $client->patch($url, $payload),
                'delete' => $client->delete($url, $payload),
                default => $client->post($url, $payload),
            };
            
            Log::info('AI microservice raw response', [
                'status' => $response->status(),
                'body_preview' => substr($response->body(), 0, 200),
            ]);
            
            return $response;
        } catch (\Exception $e) {
            Log::error('Failed to connect to AI microservice', [
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
                'ai_service_url' => $this->aiBaseUrl(),
            ]);
            throw $e;
        }
    }

    private function aiBaseUrl(): string
    {
        return rtrim(env('AI_SERVICE_URL', 'http://127.0.0.1:8002'), '/');
    }

    private function extractAiError(HttpResponse $response, string $default): string
    {
        $json = $response->json();
        if (is_array($json)) {
            $error = $json['error'] ?? $json['message'] ?? null;
            if (is_string($error) && $error !== '') {
                return $error;
            }
        }

        return $default;
    }

    private function proxyAiStatus(HttpResponse $response): int
    {
        $status = $response->status();
        return ($status >= 400 && $status < 600) ? $status : 502;
    }
}
