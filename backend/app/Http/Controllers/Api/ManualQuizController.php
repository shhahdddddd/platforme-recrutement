<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ManualQuizAssignedMail;
use App\Models\Application;
use App\Models\ManualQuiz;
use App\Models\Recruiter;
use App\Services\CompanyRealtimeNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ManualQuizController extends Controller
{
    public function __construct(
        private CompanyRealtimeNotificationService $notificationService
    ) {
    }

    public function show(Request $request, $id)
    {
        $application = $this->managedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        return response()->json([
            'success' => true,
            'data' => $application->manualQuiz?->load('questions'),
        ]);
    }

    public function store(Request $request, $id)
    {
        $application = Application::with(['candidate.user', 'jobOffer.company'])->findOrFail($id);
        $user = $request->user();

        $recruiter = Recruiter::where('user_id', $user->id)->first();
        if (
            !$recruiter ||
            !$application->jobOffer ||
            (int) $recruiter->company_id !== (int) $application->jobOffer->company_id
        ) {
            return response()->json(['error' => 'Only recruiters can create manual quizzes.'], 403);
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'time_limit' => 'required|integer|min:5|max:480',
            'questions' => 'required|array|min:1',
            'questions.*.question_text' => 'required|string',
            'questions.*.choices' => 'required|array|min:2',
            'questions.*.correct_choice' => 'required|string|size:1',
            'questions.*.difficulty' => 'nullable|string|in:easy,medium,hard',
            'questions.*.explanation' => 'nullable|string',
            'questions.*.category' => 'nullable|string',
            'questions.*.points' => 'nullable|integer',
        ]);

        // Check if a quiz already exists and if it has been started or completed
        $existingQuiz = ManualQuiz::where('application_id', $application->id)->first();
        if ($existingQuiz && ($existingQuiz->started_at || $existingQuiz->status === 'completed' || $application->manual_quiz_status === 'completed')) {
            return response()->json([
                'error' => 'This assessment has already been started or completed by the candidate and cannot be modified.'
            ], 422);
        }

        return DB::transaction(function () use ($request, $application, $recruiter) {
            $quiz = ManualQuiz::updateOrCreate(
                ['application_id' => $application->id],
                [
                    'recruiter_id' => $recruiter->id,
                    'title' => $request->title,
                    'description' => $request->description,
                    'time_limit' => $request->time_limit,
                    'status' => 'ready',
                    'started_at' => null,
                    'completed_at' => null,
                ]
            );

            $quiz->answers()->delete();
            $quiz->questions()->delete();

            foreach ($request->questions as $index => $qData) {
                $quiz->questions()->create([
                    'question_text' => $qData['question_text'],
                    'choices' => $qData['choices'],
                    'correct_choice' => $qData['correct_choice'],
                    'explanation' => $qData['explanation'] ?? '',
                    'difficulty' => $qData['difficulty'] ?? 'medium',
                    'category' => $qData['category'] ?? 'General',
                    'points' => $qData['points'] ?? 1,
                    'question_number' => $index + 1,
                ]);
            }

            $application->update([
                'status' => 'interview',
                'manual_quiz_status' => 'ready',
                'manual_quiz_score' => null,
                'manual_quiz_completed_at' => null,
            ]);

            try {
                if ($application->jobOffer && $application->candidate) {
                    $this->notificationService->notifyQuizReadyToCandidate(
                        $application->jobOffer,
                        $application->candidate,
                        (int) $application->id,
                        (string) "manual-{$quiz->id}",
                        null,
                        'manual' // Manual quiz type
                    );
                }
            } catch (\Throwable $e) {
                Log::error('FCM Manual Quiz Notify Error: ' . $e->getMessage());
            }

            try {
                Mail::to($application->candidate->user->email)->send(new ManualQuizAssignedMail(
                    $application->candidate->first_name . ' ' . $application->candidate->last_name,
                    $application->jobOffer->title,
                    $recruiter->user->name
                ));
            } catch (\Throwable $e) {
                Log::error('ManualQuizAssignedMail error: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Manual quiz saved and candidate notified.',
                'data' => $quiz->load('questions'),
            ]);
        });
    }

    public function results(Request $request, $id)
    {
        try {
            // Get authenticated user
            $user = $request->user();
            if (!$user) {
                return response()->json(['error' => 'Unauthorized. Please log in.'], 401);
            }

            Log::info("Manual Quiz Results requested by user {$user->id} for application ID: {$id}");
            
            // Find the application
            $application = Application::with(['candidate.user', 'jobOffer.company'])->find($id);
            if (!$application) {
                Log::error("Application not found for ID: {$id}");
                return response()->json(['error' => 'Application not found.'], 404);
            }

            // Check authorization
            if (!$this->userCanAccessApplication($request, $application)) {
                Log::error("User {$user->id} unauthorized for application {$id}");
                return response()->json(['error' => 'Unauthorized access to this application.'], 403);
            }

            Log::info("Application found, loading quiz...");

            $companyId = (int) $application->jobOffer->company_id;
            $candidateId = (int) $application->candidate_id;

            // 1. Try to find the quiz specifically for this application
            $quiz = ManualQuiz::where('application_id', $application->id)
                ->with(['questions.answers', 'answers', 'application'])
                ->first();

            // 2. Fallback: HISTORY lookup if no direct quiz
            if (!$quiz && $candidateId > 0) {
                Log::info("No direct quiz for application {$id}, searching history...");
                
                // Get all job offer IDs for this company first to simplify the query
                $companyJobIds = DB::table('job_offers')
                    ->where('company_id', $companyId)
                    ->pluck('id');

                $quiz = ManualQuiz::whereIn('application_id', function($query) use ($candidateId, $companyJobIds) {
                    $query->select('id')
                        ->from('applications')
                        ->where('candidate_id', $candidateId)
                        ->whereIn('job_offer_id', $companyJobIds);
                })
                ->with(['questions.answers', 'application', 'answers'])
                ->latest()
                ->first();
            }

            if (!$quiz) {
                Log::warning("No quiz found for application {$id}");

                $statusFromApplication = strtolower(trim((string) $application->manual_quiz_status));
                $hasSyncedManualSummary =
                    $application->manual_quiz_score !== null ||
                    in_array($statusFromApplication, ['completed', 'passed', 'failed'], true);

                // One-shot technical rule can sync score/status across applications without copying quiz questions.
                // In this case, return a summary payload instead of failing with 404.
                if ($hasSyncedManualSummary) {
                    return response()->json([
                        'success' => true,
                        'message' => 'Detailed quiz answers are unavailable for this synced score. Showing summary.',
                        'data' => [
                            'quiz' => [
                                'id' => null,
                                'title' => 'Technical Assessment',
                                'description' => 'Detailed per-question report is not available for this synced result.',
                                'time_limit' => null,
                                'status' => $statusFromApplication ?: 'completed',
                                'questions' => [],
                            ],
                            'score' => $application->manual_quiz_score !== null ? (float) $application->manual_quiz_score : null,
                            'status' => $statusFromApplication ?: 'completed',
                            'completed_at' => $application->manual_quiz_completed_at?->toDateTimeString(),
                            'source_application_id' => $application->id,
                            'summary_only' => true,
                        ],
                    ]);
                }

                return response()->json([
                    'success' => false,
                    'message' => 'No technical assessment found for this candidate.'
                ], 404);
            }

            $reportApplication = $quiz->application ?? $application;
            $questionsCount = $quiz->questions->count();
            $correctAnswersCount = $quiz->answers->where('is_correct', true)->count();
            $calculatedScore = $questionsCount > 0
                ? round(($correctAnswersCount / $questionsCount) * 100, 2)
                : null;

            $resolvedScore = $application->manual_quiz_score
                ?? $reportApplication?->manual_quiz_score
                ?? $calculatedScore;

            $resolvedStatus = $application->manual_quiz_status
                ?? $reportApplication?->manual_quiz_status
                ?? $quiz->status;

            if ($resolvedScore !== null && strtolower((string) $resolvedStatus) !== 'completed') {
                $resolvedStatus = 'completed';
            }

            $resolvedCompletedAt = $application->manual_quiz_completed_at
                ?? $reportApplication?->manual_quiz_completed_at
                ?? $quiz->completed_at;

            Log::info("Quiz report found (Quiz ID: {$quiz->id}) for candidate ID: " . ($application->candidate_id ?? 'Unknown'));

            // Build questions with answers
            $questionsWithAnswers = $quiz->questions->map(function ($question) use ($quiz) {
                // Get the answer for this specific quiz session
                $answer = $question->answers->where('manual_quiz_id', $quiz->id)->first();
                
                return [
                    'id' => $question->id,
                    'question_text' => $question->question_text,
                    'choices' => $question->choices,
                    'correct_choice' => $question->correct_choice,
                    'question_number' => $question->question_number,
                    'difficulty' => $question->difficulty ?? 'medium',
                    'category' => $question->category ?? 'General',
                    'points' => $question->points ?? 1,
                    'answer' => $answer ? [
                        'id' => $answer->id,
                        'selected_choice' => $answer->selected_choice,
                        'is_correct' => (bool) $answer->is_correct,
                    ] : null,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'quiz' => [
                        'id' => $quiz->id,
                        'title' => $quiz->title ?? 'Technical Assessment',
                        'description' => $quiz->description ?? '',
                        'time_limit' => $quiz->time_limit,
                        'status' => $quiz->status,
                        'questions' => $questionsWithAnswers->toArray(),
                    ],
                    'score' => $resolvedScore !== null ? (float) $resolvedScore : null,
                    'status' => $resolvedStatus,
                    'completed_at' => $resolvedCompletedAt ? $resolvedCompletedAt->toDateTimeString() : null,
                    'source_application_id' => $reportApplication?->id,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Manual Quiz Results Error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json(['error' => 'Failed to load quiz results: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $application = $this->recruiterManagedApplicationOrResponse($request, $id);
        if (!$application instanceof Application) {
            return $application;
        }

        if ($application->manualQuiz) {
            $application->manualQuiz->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Manual quiz removed.',
        ]);
    }

    private function managedApplicationOrResponse(Request $request, $id)
    {
        $user = $request->user();
        Log::info("ManualQuizController@results started", ['application_id' => $id, 'user_id' => $user->id]);

        $application = Application::with(['manualQuiz.questions', 'candidate.user', 'jobOffer.company'])->find($id);

        if (!$application) {
            Log::warning("Application not found: {$id}");
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        if (!$this->userCanAccessApplication($request, $application)) {
            Log::error("Access denied for application {$id} (User: {$user->id})");
            return response()->json(['success' => false, 'message' => 'Unauthorized access'], 403);
        }

        return $application;
    }

    private function recruiterManagedApplicationOrResponse(Request $request, $id)
    {
        $application = Application::with(['manualQuiz.questions', 'candidate.user', 'jobOffer.company'])->find($id);
        if (!$application) {
            return response()->json(['error' => 'Application not found.'], 404);
        }

        $user = $request->user();
        if (
            !$user ||
            !$user->isRecruiter() ||
            !$user->recruiter ||
            !$application->jobOffer ||
            (int) $user->recruiter->company_id !== (int) $application->jobOffer->company_id
        ) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return $application;
    }

    private function userCanAccessApplication(Request $request, Application $application): bool
    {
        $user = $request->user();
        if (!$user || !$application->jobOffer) {
            return false;
        }

        // Ensure all relations are loaded so checks don't silently fail
        $user->loadMissing(['company', 'hr', 'recruiter']);

        $targetCompanyId = (int) $application->jobOffer->company_id;
        $userRole = strtolower((string) $user->role);

        Log::info("Permission check", [
            'user_id' => $user->id,
            'role' => $user->role,
            'company_id' => $user->company?->id,
            'hr_company_id' => $user->hr?->company_id,
            'target_company_id' => $targetCompanyId,
        ]);

        // 1. Check if user is the company owner
        if ($user->company && (int) $user->company->id === $targetCompanyId) {
            Log::info("Access granted: company owner");
            return true;
        }

        // 2. Check if user belongs to the company via HR profile
        if ($user->hr && (int) $user->hr->company_id === $targetCompanyId) {
            Log::info("Access granted: HR member");
            return true;
        }

        // 3. Check if user is a recruiter for this company
        if ($user->recruiter && (int) $user->recruiter->company_id === $targetCompanyId) {
            Log::info("Access granted: recruiter");
            return true;
        }

        // 4. Role-based fallback (case-insensitive) — last resort
        if (in_array($userRole, ['company', 'company_admin', 'hr'])) {
            Log::info("Access granted: role-based fallback ({$user->role})");
            return true;
        }

        Log::warning("Access DENIED for user {$user->id} (role={$user->role}) on company {$targetCompanyId}");
        return false;
    }
}
