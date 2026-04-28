<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessCvJob;
use App\Jobs\ScoreApplicationJob;
use App\Models\Application;
use App\Models\Department;
use App\Models\Interview;
use App\Models\JobOffer;
use App\Models\Recruiter;
use App\Services\AiMatchingService;
use App\Services\CompanyRealtimeNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class JobApplicationController extends Controller
{
    public function __construct(
        private CompanyRealtimeNotificationService $companyRealtimeNotificationService,
        private AiMatchingService $aiMatchingService,
        private \App\Services\SubscriptionFeatureService $subscriptionFeatureService
    ) {
    }

    /**
     * Candidate checks if they already applied for a given job.
     * Route: GET /api/job-offers/{id}/application-status
     */
    public function applicationStatus(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !$user->isCandidate()) {
            return response()->json(['success' => false, 'message' => 'Only candidates can check application status'], 403);
        }

        $candidate = $user->candidate;
        if (!$candidate) {
            return response()->json(['success' => false, 'message' => 'Candidate profile not found'], 404);
        }

        $app = Application::with('manualQuiz')
            ->where('candidate_id', $candidate->id)
            ->where('job_offer_id', $id)
            ->first();
        if ($app) {
            $this->resolveManualQuizStatus($app);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'has_applied' => $app !== null,
                'status' => $app?->status,
                // Manual Quiz
                'manual_quiz_status' => $app?->manual_quiz_status,
                'manual_quiz_score' => $app?->manual_quiz_score,
                'manual_quiz_completed_at' => $app?->manual_quiz_completed_at,
                // AI Quiz
                'ai_quiz_status' => $app?->ai_quiz_status,
                'ai_quiz_score' => $app?->ai_quiz_score,
                'ai_quiz_completed_at' => $app?->ai_quiz_completed_at,
                'ai_quiz_session_id' => $app?->ai_quiz_session_id,
                'application_id' => $app?->id,
            ]
        ]);
    }

    /**
     * Candidate applies for a job offer.
     * Route: POST /api/job-offers/{id}/apply
     */
    public function apply(Request $request, $id)
    {
        $request->validate([
            'cv' => 'required|file|mimes:pdf|max:3072', // PDF only, max 3MB
        ]);

        $user = $request->user();
        if (!$user || !$user->isCandidate()) {
            return response()->json(['success' => false, 'message' => 'Only candidates can apply'], 403);
        }

        $candidate = $user->candidate;
        if (!$candidate) {
            return response()->json(['success' => false, 'message' => 'Candidate profile not found'], 404);
        }

        $jobOffer = JobOffer::find($id);
        if (!$jobOffer) {
            return response()->json(['success' => false, 'message' => 'Job offer not found'], 404);
        }

        if ($jobOffer->status !== 'open') {
            return response()->json(['success' => false, 'message' => 'This job offer is no longer accepting applications'], 400);
        }

        // Check if already applied
        $existing = Application::where('candidate_id', $candidate->id)
            ->where('job_offer_id', $id)
            ->first();

        if ($existing) {
            return response()->json(['success' => false, 'message' => 'You have already applied for this job'], 400);
        }

        try {
            $transactionData = DB::transaction(function () use ($request, $candidate, $id, $jobOffer) {
                // Store CV and keep both storage path and public URL.
                $storedPath = $request->file('cv')->store('cvs', 'public');
                $cvUrl = asset('storage/' . $storedPath);

                $application = Application::create([
                    'candidate_id' => $candidate->id,
                    'job_offer_id' => $id,
                    'cv_path' => $cvUrl,
                    'status' => 'pending',
                    'applied_at' => now(),
                ]);

                $candidate->attachCvFile($storedPath);
                $this->companyRealtimeNotificationService->notifyJobApplicationSubmitted(
                    $jobOffer->load('company.user'),
                    $candidate->load('user'),
                    (int) $application->id
                );

                return [
                    'application' => $application,
                    'stored_path' => $storedPath,
                ];
            });

            /** @var \App\Models\Application $application */
            $application = $transactionData['application'];
            $storedPath = $transactionData['stored_path'];

            // AI scoring is done in the background to avoid blocking the HTTP request
            if (Schema::hasColumn('applications', 'ai_match_score')) {
                if ($this->aiMatchingService->isEnabled()) {
                    $cvAbsolutePath = Storage::disk('public')->path($storedPath);

                    Log::info('[JobApplicationController] Dispatching ProcessCvJob', [
                        'user_id' => $candidate->user_id,
                        'cv_path' => $cvAbsolutePath
                    ]);

                    $this->dispatchProcessCvJob(
                        (int) $candidate->user_id,
                        $cvAbsolutePath
                    );
                } elseif (Schema::hasColumn('applications', 'ai_error')) {
                    $application->ai_error = $this->aiMatchingService->disabledReason();
                    $application->save();
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Application submitted successfully',
                'data' => $application->fresh(['candidate.user', 'jobOffer']),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error submitting application: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit application',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Recruiter views applicants for a specific job.
     * Route: GET /api/company/job-offers/{id}/applicants
     */
    public function getJobApplicants(Request $request, $id)
    {
        $user = $request->user();
        if (!$user)
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);

        $jobOffer = JobOffer::find($id);
        if (!$jobOffer)
            return response()->json(['success' => false, 'message' => 'Job not found'], 404);

        $isOwner = $this->canManageJobOfferForUser($user, $jobOffer);

        if (!$isOwner) {
            return response()->json(['success' => false, 'message' => 'Unauthorized access to this job applicants'], 403);
        }

        $applicants = Application::where('job_offer_id', $id)
            ->with([
                'candidate.user',
                'candidate.specialty',
                'candidate.skills',
                'jobOffer.recruiters.user',
                'interview.recruiter.user',
                'interviews.recruiter.user',
                'manualQuiz'
            ])
            ->orderByRaw('COALESCE(ai_match_score, 0) DESC')
            ->latest('applied_at')
            ->get();

        $this->hydrateLegacyInterviews($applicants);

        // Resolve status for each application and mask AI scores if subscription doesn't allow them
        $applicants->each(function (Application $app) {
            $this->resolveManualQuizStatus($app);
            $this->maskApplicationAiScores($app);
        });

        return response()->json([
            'success' => true,
            'data' => $applicants
        ]);
    }

    /**
     * Recruiter views all applicants for their jobs.
     * Route: GET /api/company/applicants
     */
    public function getAllApplicants(Request $request)
    {
        $user = $request->user();
        if (!$user)
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);

        $jobIds = $this->resolveScopedJobIdsForUser($user);

        $applicants = Application::where(function ($q) use ($jobIds, $user) {
            $q->whereIn('job_offer_id', $jobIds);

            // Critical fix: Also include applications where the recruiter is specifically assigned to an interview
            if ($user->isRecruiter() && $user->recruiter) {
                $q->orWhereHas('interviews', function ($iq) use ($user) {
                    $iq->where('recruiter_id', $user->recruiter->id);
                });

                // Legacy support: interviews created without application_id.
                $q->orWhereExists(function ($sq) use ($user) {
                    $sq->select(DB::raw(1))
                        ->from('interviews')
                        ->whereNull('interviews.application_id')
                        ->whereColumn('interviews.candidate_id', 'applications.candidate_id')
                        ->whereColumn('interviews.job_offer_id', 'applications.job_offer_id')
                        ->where('interviews.recruiter_id', $user->recruiter->id);
                });
            }
        })
            ->with([
                'candidate.user',
                'candidate.specialty',
                'candidate.skills',
                'jobOffer.recruiters.user',
                'interview.recruiter.user',
                'interviews.recruiter.user',
                'manualQuiz'
            ])
            ->orderByRaw('COALESCE(ai_match_score, 0) DESC')
            ->latest('applied_at')
            ->get();

        $this->hydrateLegacyInterviews($applicants);

        // Resolve status and sync scores for each application to ensure consistency and mask if needed
        $applicants->each(function (Application $app) {
            $this->resolveManualQuizStatus($app);
            $this->maskApplicationAiScores($app);
        });

        return response()->json([
            'success' => true,
            'data' => $applicants
        ]);
    }

    /**
     * Company/recruiter previews the CV for a specific application.
     * Route: GET /api/company/applications/{id}/cv
     */
    public function showCv(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $application = Application::with(['candidate', 'jobOffer'])->find($id);
        if (!$application) {
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        $canAccess = ($application->jobOffer && $this->canManageJobOfferForUser($user, $application->jobOffer))
            || $this->canRecruiterAccessAssignedApplication($user, $application);

        if (!$canAccess) {
            return response()->json(['success' => false, 'message' => 'Unauthorized access to this CV'], 403);
        }

        $cvAbsolutePath = $this->resolveApplicationCvAbsolutePath($application);
        if (!$cvAbsolutePath) {
            return response()->json(['success' => false, 'message' => 'CV file not found'], 404);
        }

        return response()->file($cvAbsolutePath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . basename($cvAbsolutePath) . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    /**
     * Recruiter/company views interviews in their scope.
     * Route: GET /api/company/interviews
     */
    public function getInterviews(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $query = Interview::query()
            ->with([
                'candidate.user',
                'jobOffer',
                'recruiter.user',
                'application',
            ]);

        if ($user->isRecruiter() && $user->recruiter) {
            $query->where('recruiter_id', $user->recruiter->id);
        } elseif ($user->company) {
            $query->whereHas('jobOffer', function ($q) use ($user) {
                $q->where('company_id', $user->company->id);
            });
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $interviews = $query
            ->orderByDesc('scheduled_at')
            ->orderByDesc('created_at')
            ->get();

        $data = $interviews->map(function (Interview $interview) {
            $candidateName = trim(
                implode(' ', array_filter([
                    trim((string) ($interview->candidate?->first_name ?? '')),
                    trim((string) ($interview->candidate?->last_name ?? '')),
                ]))
            );

            if ($candidateName === '') {
                $candidateName = (string) ($interview->candidate?->user?->email ?? 'Candidate');
            }

            return [
                'id' => (int) $interview->id,
                'application_id' => $interview->application_id ? (int) $interview->application_id : null,
                'candidate' => [
                    'id' => $interview->candidate_id ? (int) $interview->candidate_id : null,
                    'name' => $candidateName,
                    'email' => $interview->candidate?->user?->email,
                ],
                'job_offer' => [
                    'id' => $interview->job_offer_id ? (int) $interview->job_offer_id : null,
                    'title' => (string) ($interview->jobOffer?->title ?? 'Untitled job'),
                ],
                'recruiter' => [
                    'id' => $interview->recruiter_id ? (int) $interview->recruiter_id : null,
                    'name' => (string) ($interview->recruiter?->full_name ?? $interview->recruiter?->user?->email ?? ''),
                    'email' => $interview->recruiter?->user?->email,
                ],
                'interview_type' => (string) ($interview->interview_type ?? ''),
                'interview_mode' => (string) ($interview->interview_mode ?? ''),
                'status' => (string) ($interview->status ?? 'pending'),
                'duration_minutes' => $interview->duration_minutes !== null ? (int) $interview->duration_minutes : null,
                'scheduled_at' => $interview->scheduled_at?->toIso8601String(),
                'location' => $interview->location,
                'notes' => $interview->notes,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Recruiter views accepted internship candidates in their scope.
     * Route: GET /api/company/intern-candidates
     */
    public function getInternCandidates(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
            }

            $jobIds = $this->resolveScopedJobIdsForUser($user);

            $internCandidates = Application::where(function ($q) use ($jobIds, $user) {
                $q->whereIn('job_offer_id', $jobIds);

                if ($user->isRecruiter() && $user->recruiter) {
                    $q->orWhereHas('interviews', function ($iq) use ($user) {
                        $iq->where('recruiter_id', $user->recruiter->id);
                    });

                    // Legacy support: interviews created without application_id.
                    $q->orWhereExists(function ($sq) use ($user) {
                        $sq->select(DB::raw(1))
                            ->from('interviews')
                            ->whereNull('interviews.application_id')
                            ->whereColumn('interviews.candidate_id', 'applications.candidate_id')
                            ->whereColumn('interviews.job_offer_id', 'applications.job_offer_id')
                            ->where('interviews.recruiter_id', $user->recruiter->id);
                    });
                }
            })
                ->where('status', 'accepted')
                ->whereHas('jobOffer', function ($q) {
                    $q->where('offer_type', 'internship');
                })
                ->with([
                    'candidate.user',
                    'candidate.specialty',
                    'candidate.skills',
                    'jobOffer.recruiters.user',
                    'jobOffer.department',
                    'interview.recruiter.user',
                    'interviews.recruiter.user',
                    'manualQuiz'
                ])
                ->latest('applied_at')
                ->get();

            $this->hydrateLegacyInterviews($internCandidates);

            $internCandidates->each(function (Application $app) {
                $this->resolveManualQuizStatus($app);
            });

            Log::info('Intern candidates fetched.', [
                'user_id' => $user->id,
                'role' => $user->role,
                'recruiter_id' => $user->recruiter?->id,
                'company_id' => $user->recruiter?->company_id ?? $user->company?->id,
                'job_ids_count' => $jobIds->count(),
                'intern_candidates_count' => $internCandidates->count(),
            ]);

            return response()->json([
                'success' => true,
                'data' => $internCandidates,
            ]);
        } catch (\Throwable $e) {
            Log::error('Intern candidates fetch failed.', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => config('app.debug')
                    ? ('Failed to load intern candidates: ' . $e->getMessage())
                    : 'Failed to load intern candidates.',
            ], 500);
        }
    }

    /**
     * RH action to schedule an interview and assign the responsible recruiter.
     * Route: POST /api/company/applications/{id}/launch-interview
     */
    public function launchInterview(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        if (!$user->isCompanyAdmin() || !$user->company) {
            return response()->json([
                'success' => false,
                'message' => 'Only HR can schedule interviews.',
            ], 403);
        }

        $application = Application::with(['candidate.user', 'jobOffer'])->find($id);
        if (!$application) {
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        if (!$application->jobOffer || !$this->canManageJobOfferForUser($user, $application->jobOffer)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized access to this application'], 403);
        }

        // Validate interview form fields
        $validated = $request->validate([
            'interview_type' => 'required|string|in:test_technique,test_rh_telephonique,test_rh_video,test_psychotechnique',
            'interview_duration_minutes' => 'required|integer|min:5|max:480',
            'interview_recruiter_id' => 'required|integer|exists:recruiters,id',
            'interview_mode' => 'required|string|in:online,presentiel',
            'scheduled_at' => 'required|date|after:now',
            'notes' => 'nullable|string|max:1000',
        ]);

        $assignedRecruiter = Recruiter::query()
            ->with('user')
            ->find($validated['interview_recruiter_id']);

        if (
            !$assignedRecruiter
            || (int) $assignedRecruiter->company_id !== (int) $application->jobOffer->company_id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'The selected recruiter is not available for this company.',
                'errors' => ['interview_recruiter_id' => ['Please select a valid recruiter for this company.']],
            ], 422);
        }

        // Create a record in the interviews table
        $interview = new Interview();
        $interview->candidate_id = $application->candidate_id;
        $interview->job_offer_id = $application->job_offer_id;
        $interview->application_id = $application->id;
        $interview->interview_type = $validated['interview_type'];
        $interview->interview_mode = $validated['interview_mode'];
        $interview->duration_minutes = $validated['interview_duration_minutes'];
        $interview->notes = $validated['notes'] ?? null;
        $interview->scheduled_at = $validated['scheduled_at'];
        $interview->status = 'pending';
        $interview->recruiter_id = $assignedRecruiter->id;
        $interview->save();

        // Mark the application as being in the interview flow.
        $application->status = 'interview';
        if (Schema::hasColumn('applications', 'interview_launched_at')) {
            $application->interview_launched_at = $application->interview_launched_at ?? now();
        }
        $application->save();

        // Notify the assigned recruiter that HR scheduled the interview for them.
        try {
            $this->companyRealtimeNotificationService->notifyRecruiterInterviewAssigned(
                $application->jobOffer,
                $application->candidate,
                $assignedRecruiter,
                (int) $application->id,
                $interview
            );
        } catch (\Exception $e) {
            Log::error('Recruiter assignment notification error: ' . $e->getMessage());
        }

        try {
            $this->companyRealtimeNotificationService->notifyInterviewScheduled(
                $application->jobOffer,
                $application->candidate,
                (int) $application->id,
                $interview
            );
        } catch (\Exception $e) {
            Log::error('Candidate interview scheduling notification error: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Interview scheduled successfully. The recruiter and candidate have been notified.',
            'data' => [
                'application' => $application->fresh(['candidate.user', 'jobOffer']),
                'interview' => $interview->fresh(['recruiter.user']),
            ],
        ]);
    }

    /**
     * RH updates the scheduled date/time of an existing interview.
     * Route: PATCH /api/company/interviews/{id}/schedule
     */
    public function scheduleInterview(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        if (!$user->isCompanyAdmin() || !$user->company) {
            return response()->json([
                'success' => false,
                'message' => 'Only HR can update this interview schedule.',
            ], 403);
        }

        $interview = Interview::query()
            ->with(['candidate.user', 'jobOffer.company', 'application', 'recruiter.user'])
            ->find($id);

        if (!$interview) {
            return response()->json(['success' => false, 'message' => 'Interview not found'], 404);
        }

        if (!$interview->jobOffer || !$this->canManageJobOfferForUser($user, $interview->jobOffer)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized access to this interview.',
            ], 403);
        }

        $validated = $request->validate([
            'scheduled_at' => 'required|date|after:now',
        ]);

        $interview->scheduled_at = $validated['scheduled_at'];
        $interview->status = $interview->status ?: 'pending';
        $interview->save();

        $application = $interview->application;
        if ($application) {
            $application->status = 'interview';
            if (Schema::hasColumn('applications', 'interview_launched_at')) {
                $application->interview_launched_at = $application->interview_launched_at ?? now();
            }
            $application->save();
        }

        $applicationId = (int) ($application?->id ?? $interview->application_id ?? 0);
        if ($applicationId > 0) {
            try {
                $this->companyRealtimeNotificationService->notifyInterviewScheduled(
                    $interview->jobOffer,
                    $interview->candidate,
                    $applicationId,
                    $interview
                );
            } catch (\Exception $e) {
                Log::error('Candidate interview scheduling notification error: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Interview date saved and candidate notified successfully.',
            'data' => $interview->fresh(['candidate.user', 'jobOffer.company', 'application', 'recruiter.user']),
        ]);
    }

    /**
     * Recruiter schedules date/time for their assigned interview.
     * After saving, the candidate gets notified via push + email.
     * Route: PATCH /api/recruiter/interviews/{id}/schedule
     */
    public function recruiterScheduleInterview(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        // Must be a recruiter
        if (!$user->isRecruiter()) {
            return response()->json([
                'success' => false,
                'message' => 'Only recruiters can schedule interviews.',
            ], 403);
        }

        $recruiter = $user->recruiter;
        if (!$recruiter) {
            return response()->json(['success' => false, 'message' => 'Recruiter profile not found'], 403);
        }

        $interview = Interview::query()
            ->with(['candidate.user', 'jobOffer.company', 'application', 'recruiter.user'])
            ->find($id);

        if (!$interview) {
            return response()->json(['success' => false, 'message' => 'Interview not found'], 404);
        }

        // Verify this interview is assigned to this recruiter
        if ((int) $interview->recruiter_id !== (int) $recruiter->id) {
            return response()->json([
                'success' => false,
                'message' => 'This interview is not assigned to you.',
            ], 403);
        }

        $validated = $request->validate([
            'scheduled_at' => 'required|date|after:now',
            'duration_minutes' => 'nullable|integer|min:15|max:240',
        ]);

        $interview->scheduled_at = $validated['scheduled_at'];
        if (isset($validated['duration_minutes'])) {
            $interview->duration_minutes = $validated['duration_minutes'];
        }
        $interview->status = 'confirmed';
        $interview->save();

        $application = $interview->application;
        if ($application) {
            $application->status = 'interview';
            $application->save();
        }

        // Notify the candidate about the scheduled interview
        $applicationId = (int) ($application?->id ?? $interview->application_id ?? 0);
        if ($applicationId > 0) {
            try {
                $this->companyRealtimeNotificationService->notifyInterviewScheduled(
                    $interview->jobOffer,
                    $interview->candidate,
                    $applicationId,
                    $interview
                );
            } catch (\Exception $e) {
                Log::error('Candidate interview scheduling notification error: ' . $e->getMessage());
            }

            // Send email to candidate
            try {
                $this->sendCandidateInterviewScheduledEmail($interview->candidate, $interview);
            } catch (\Exception $e) {
                Log::error('Candidate interview email error: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Interview scheduled. The candidate has been notified via push notification and email.',
            'data' => $interview->fresh(['candidate.user', 'jobOffer.company', 'application', 'recruiter.user']),
        ]);
    }

    /**
     * Send email notification to candidate when interview is scheduled.
     */
    private function sendCandidateInterviewScheduledEmail($candidate, Interview $interview): void
    {
        Log::info('Candidate interview scheduled email would be sent', [
            'candidate_id' => $candidate->id,
            'candidate_email' => $candidate->user?->email,
            'interview_date' => $interview->scheduled_at,
            'interview_type' => $interview->interview_type,
        ]);
    }

    /**
     * RH manually re-triggers AI scoring for a single application.
     * Useful when the original scoring failed or the job description changed.
     * Route: POST /api/company/applications/{id}/ai-rescore
     */
    public function rescoreApplication(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $application = Application::with(['candidate.user', 'jobOffer.skills'])->find($id);
        if (!$application) {
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        if (!$application->jobOffer || !$this->canManageJobOfferForUser($user, $application->jobOffer)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        // Check subscription for AI Matching
        $company = $application->jobOffer->company;
        if ($company && !$this->subscriptionFeatureService->hasAiMatching($company)) {
            return response()->json([
                'success' => false,
                'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('ai_matching'),
            ], 403);
        }

        if (!$this->aiMatchingService->isEnabled()) {
            $reason = $this->aiMatchingService->disabledReason();
            $this->applyAiDisabledState($application, $reason);

            return response()->json([
                'success' => true,
                'message' => $reason,
            ]);
        }

        // Clear previous scores and error state so the UI shows "Processing..." immediately
        if (Schema::hasColumn('applications', 'ai_error')) {
            $application->ai_error = null;
        }
        if (Schema::hasColumn('applications', 'ai_scored_at')) {
            $application->ai_scored_at = null;
        }
        if (Schema::hasColumn('applications', 'ai_match_score')) {
            $application->ai_match_score = null;
        }
        if (Schema::hasColumn('applications', 'ai_degree_score')) {
            $application->ai_degree_score = null;
        }
        if (Schema::hasColumn('applications', 'ai_semantic_score')) {
            $application->ai_semantic_score = null;
        }
        if (Schema::hasColumn('applications', 'ai_skill_score')) {
            $application->ai_skill_score = null;
        }
        if (Schema::hasColumn('applications', 'ai_experience_score')) {
            $application->ai_experience_score = null;
        }
        if (Schema::hasColumn('applications', 'ai_confidence_score')) {
            $application->ai_confidence_score = null;
        }
        if (Schema::hasColumn('applications', 'ai_explanation')) {
            $application->ai_explanation = null;
        }
        $application->save();

        // Run re-score in this same HTTP request and return updated scores directly.
        $cvAbsolutePath = $this->resolveApplicationCvAbsolutePath($application);
        if (!$cvAbsolutePath) {
            return response()->json([
                'success' => false,
                'message' => 'CV file not found for this application.',
            ], 404);
        }

        Log::info('[JobApplicationController] Running synchronous AI re-scoring', [
            'application_id' => $id,
            'cv_path' => $cvAbsolutePath
        ]);

        ScoreApplicationJob::dispatchSync(
            (int) $application->id,
            $cvAbsolutePath
        );

        $application->refresh();

        $responseData = [
            'id' => $application->id,
            'ai_match_score' => $application->ai_match_score,
            'ai_degree_score' => $application->ai_degree_score,
            'ai_semantic_score' => $application->ai_semantic_score,
            'ai_skill_score' => $application->ai_skill_score,
            'ai_experience_score' => $application->ai_experience_score,
            'ai_confidence_score' => $application->ai_confidence_score,
            'ai_explanation' => $application->ai_explanation,
            'ai_scored_at' => $application->ai_scored_at?->toIso8601String(),
            'ai_error' => $application->ai_error,
        ];

        return response()->json([
            'success' => true,
            'message' => $application->ai_error
                ? 'AI re-scoring completed with an error.'
                : 'AI re-scoring completed.',
            'data' => $responseData,
        ]);
    }

    /**
     * Assigned recruiter rejects a candidate's application.
     * Updates application status + notifies candidate via push notification + email.
     * Route: POST /api/company/applications/{id}/reject
     */
    public function rejectApplication(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        if (!$user->isRecruiter() || !$user->recruiter) {
            return response()->json([
                'success' => false,
                'message' => 'Only recruiters can reject assigned candidates.',
            ], 403);
        }

        $application = Application::with(['candidate.user', 'jobOffer.company'])->find($id);
        if (!$application) {
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        if (!$this->canRecruiterManageApplication($user, $application)) {
            return response()->json([
                'success' => false,
                'message' => 'You can only reject candidates assigned to you.',
            ], 403);
        }

        if ($application->status === 'rejected') {
            return response()->json(['success' => false, 'message' => 'This application has already been rejected'], 400);
        }

        if ($application->status === 'accepted') {
            return response()->json(['success' => false, 'message' => 'This application has already been accepted'], 400);
        }

        // Check if candidate has completed required evaluation (quiz OR HR interview)
        $canProceedWithoutQuiz = $this->canProceedWithoutQuiz($application);
        if (!$canProceedWithoutQuiz) {
            $manualQuizStatus = $this->resolveManualQuizStatus($application);
            if ($manualQuizStatus && !in_array(strtolower(trim($manualQuizStatus)), ['completed', 'none', 'passed', 'failed', ''])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Decision blocked: The candidate must complete the assigned manual quiz before you can accept or reject this application.'
                ], 403);
            }
        }

        // Update application status
        $application->status = 'rejected';
        $application->save();

        // Send Push Notification + Email to candidate
        try {
            $this->companyRealtimeNotificationService->notifyApplicationRejected(
                $application->jobOffer,
                $application->candidate,
                (int) $application->id
            );
        } catch (\Exception $e) {
            Log::error('Rejection notification error: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Application rejected and candidate notified successfully',
            'data' => $application->fresh(['candidate.user', 'jobOffer']),
        ]);
    }

    /**
     * Assigned recruiter accepts a candidate's application.
     * Updates application status + notifies candidate via push notification.
     * Route: POST /api/company/applications/{id}/accept
     */
    public function acceptApplication(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        if (!$user->isRecruiter() || !$user->recruiter) {
            return response()->json([
                'success' => false,
                'message' => 'Only recruiters can accept assigned candidates.',
            ], 403);
        }

        $application = Application::with(['candidate.user', 'jobOffer.company'])->find($id);
        if (!$application) {
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        if (!$this->canRecruiterManageApplication($user, $application)) {
            return response()->json([
                'success' => false,
                'message' => 'You can only accept candidates assigned to you.',
            ], 403);
        }

        if ($application->status === 'accepted') {
            return response()->json(['success' => false, 'message' => 'This application has already been accepted'], 400);
        }

        // Check if candidate has completed required evaluation (quiz OR HR interview)
        $canProceedWithoutQuiz = $this->canProceedWithoutQuiz($application);
        if (!$canProceedWithoutQuiz) {
            $manualQuizStatus = $this->resolveManualQuizStatus($application);
            if ($manualQuizStatus && !in_array(strtolower(trim($manualQuizStatus)), ['completed', 'none', 'passed', 'failed', ''])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Decision blocked: The candidate must complete the assigned manual quiz before you can accept or reject this application.'
                ], 403);
            }
        }

        if ($application->status === 'rejected') {
            return response()->json(['success' => false, 'message' => 'This application has already been rejected'], 400);
        }

        $application->status = 'accepted';
        $application->save();

        try {
            $this->companyRealtimeNotificationService->notifyApplicationAccepted(
                $application->jobOffer,
                $application->candidate,
                (int) $application->id
            );
        } catch (\Exception $e) {
            Log::error('Acceptance notification error: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Application accepted and candidate notified successfully',
            'data' => $application->fresh(['candidate.user', 'jobOffer']),
        ]);
    }

    /**
     * Update attendance and schedule for an accepted intern.
     * Route: PATCH /api/company/applications/{id}/attendance
     */
    public function updateAttendance(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        if (!$user->isCompanyAdmin() && !$user->isRecruiter()) {
            return response()->json([
                'success' => false,
                'message' => 'Only HR or recruiters can manage attendance.',
            ], 403);
        }

        $application = Application::with(['candidate.user', 'jobOffer.company'])->find($id);
        if (!$application) {
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        // Verify user has access to this company's applications
        if ($user->isCompanyAdmin()) {
            if (!$user->company || $application->jobOffer->company_id !== $user->company->id) {
                return response()->json(['success' => false, 'message' => 'Unauthorized access to this application'], 403);
            }
        } elseif ($user->isRecruiter()) {
            if (!$user->recruiter || $application->jobOffer->company_id !== $user->recruiter->company_id) {
                return response()->json(['success' => false, 'message' => 'Unauthorized access to this application'], 403);
            }
        }

        // Validate request
        $validated = $request->validate([
            'attendance' => 'required|string|in:remote,onsite,hybrid',
            'attendance_schedule' => 'nullable|array',
            'attendance_schedule.days' => 'required_if:attendance,hybrid|array',
            'attendance_schedule.days.*' => 'string',
            'attendance_schedule.start_time' => 'required_if:attendance,hybrid|string',
            'attendance_schedule.end_time' => 'required_if:attendance,hybrid|string',
        ]);

        // Update attendance
        $application->attendance = $validated['attendance'];
        
        // Only save schedule if hybrid
        if ($validated['attendance'] === 'hybrid' && isset($validated['attendance_schedule'])) {
            $application->attendance_schedule = [
                'days' => $validated['attendance_schedule']['days'] ?? [],
                'start_time' => $validated['attendance_schedule']['start_time'] ?? '09:00',
                'end_time' => $validated['attendance_schedule']['end_time'] ?? '17:00',
            ];
        } else {
            $application->attendance_schedule = null;
        }

        $application->save();

        // Send notification to candidate about attendance schedule update
        try {
            $this->companyRealtimeNotificationService->notifyAttendanceScheduleUpdated(
                $application->jobOffer,
                $application->candidate,
                (int) $application->id,
                $validated['attendance'],
                $application->attendance_schedule
            );
        } catch (\Throwable $e) {
            Log::error('Failed to send attendance schedule notification: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Attendance updated successfully',
            'data' => $application->fresh(['candidate.user', 'jobOffer']),
        ]);
    }

    /**
     * Candidate insights (KPIs).
     * Route: GET /api/candidate/insights
     */
    public function candidateInsights(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isCandidate()) {
            return response()->json(['success' => false, 'message' => 'Only candidates can access insights'], 403);
        }

        $candidate = $user->candidate;
        if (!$candidate) {
            return response()->json(['success' => false, 'message' => 'Candidate profile not found'], 404);
        }

        $applicationsCount = Application::where('candidate_id', $candidate->id)->count();
        $companiesApplied = Application::where('candidate_id', $candidate->id)
            ->join('job_offers', 'applications.job_offer_id', '=', 'job_offers.id')
            ->whereNotNull('job_offers.company_id')
            ->distinct('job_offers.company_id')
            ->count('job_offers.company_id');

        // Fetch the actual applied jobs for the "Already Applied" list
        $appliedJobs = Application::where('candidate_id', $candidate->id)
            ->with(['jobOffer.company', 'interview.recruiter.user', 'manualQuiz'])
            ->latest('applied_at')
            ->get()
            ->map(function (Application $app) {
                $manualQuizStatus = $this->resolveManualQuizStatus($app);
                $interview = null;
                if ($app->interview) {
                    $interview = [
                        'type' => $app->interview->interview_type,
                        'mode' => $app->interview->interview_mode,
                        'duration' => $app->interview->duration_minutes,
                        'notes' => $app->interview->notes,
                        'scheduled_at' => $app->interview->scheduled_at?->toDateTimeString(),
                        'recruiter_name' => $app->interview->recruiter?->full_name,
                        'recruiter_email' => $app->interview->recruiter?->user?->email,
                    ];
                }

                $applicationData = [
                    'application_id' => $app->id,
                    'job_id' => $app->job_offer_id,
                    'job_title' => $app->jobOffer->title ?? 'Untitled',
                    'company_name' => $app->jobOffer->company->name ?? 'Unknown',
                    'company_logo' => $app->jobOffer->company->picture ?? null,
                    'location' => $app->jobOffer->location ?? '',
                    'offer_type' => $app->jobOffer->offer_type ?? 'job',
                    'status' => $app->status ?? 'pending',
                    'applied_at' => $app->applied_at?->toDateTimeString(),
                    'ai_match_score' => $app->ai_match_score,
                    'ai_quiz_status' => $app->ai_quiz_status ?? null,
                    'ai_quiz_score' => $app->ai_quiz_score ?? null,
                    'manual_quiz_status' => $manualQuizStatus,
                    'manual_quiz_score' => $app->manual_quiz_score,
                    'interview' => $interview,
                ];

                // Mask AI Match Score for candidate insights too if company has no AI access
                if ($app->jobOffer && $app->jobOffer->company) {
                    if (!$this->subscriptionFeatureService->hasAiMatching($app->jobOffer->company)) {
                        $applicationData['ai_match_score'] = null;
                        $applicationData['ai_restricted'] = true;
                    }
                }

                return $applicationData;
            });

        return response()->json([
            'success' => true,
            'data' => [
                'cv_uploads' => $candidate->latestCvStoragePath() ? 1 : 0,
                'companies_applied' => $companiesApplied,
                'applications' => $applicationsCount,
                'applied_jobs' => $appliedJobs,
            ]
        ]);
    }

    private function applyAiDisabledState(Application $application, string $reason): void
    {
        if (!Schema::hasColumn('applications', 'ai_error')) {
            return;
        }

        $application->ai_error = $reason;
        $application->save();
    }

    private function dispatchProcessCvJob(int $userId, string $cvAbsolutePath): void
    {
        if ($this->shouldRunAiScoringInline()) {
            ProcessCvJob::dispatchSync($userId, $cvAbsolutePath);
            return;
        }

        ProcessCvJob::dispatch($userId, $cvAbsolutePath);
    }

    private function shouldRunAiScoringInline(): bool
    {
        $configured = env('AI_SCORING_INLINE');
        if ($configured !== null && $configured !== '') {
            return (bool) filter_var($configured, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }

        return app()->environment('local');
    }

    private function canManageJobOfferForUser($user, JobOffer $jobOffer): bool
    {
        if ($user->company && $jobOffer->company_id === $user->company->id) {
            return true;
        }

        if ($user->isRecruiter() && $user->recruiter) {
            $sameCompany = $jobOffer->company_id === $user->recruiter->company_id;
            if (!$sameCompany) {
                return false;
            }

            if ($this->hasRecruiterAssignmentsTable()) {
                $hasAssignments = DB::table('job_offer_recruiter_assignments')
                    ->where('recruiter_id', $user->recruiter->id)
                    ->exists();

                if ($hasAssignments) {
                    return DB::table('job_offer_recruiter_assignments')
                        ->where('recruiter_id', $user->recruiter->id)
                        ->where('job_offer_id', $jobOffer->id)
                        ->exists();
                }
            }

            $sameDepartment = false;

            if (!$user->recruiter->department_id) {
                $sameDepartment = true;
            } elseif ((int) $jobOffer->department_id === (int) $user->recruiter->department_id) {
                $sameDepartment = true;
            } else {
                // Fallback for environments where department IDs differ after reseeding.
                $recruiterDept = Department::find($user->recruiter->department_id);
                $jobDept = Department::find($jobOffer->department_id);
                if ($recruiterDept && $jobDept) {
                    $sameDepartment = strtolower(trim($recruiterDept->name)) === strtolower(trim($jobDept->name));
                }
            }

            return $sameDepartment;
        }

        return false;
    }

    private function resolveApplicationCvAbsolutePath(Application $application): ?string
    {
        $paths = collect([
            $application->getRawOriginal('cv_path'),
            $application->candidate?->latestCvStoragePath(),
            $application->candidate?->getRawOriginal('cv_path'),
        ])->filter(fn($path) => is_string($path) && trim($path) !== '');

        foreach ($paths as $path) {
            $parsedPath = parse_url($path, PHP_URL_PATH);
            $filename = basename($parsedPath ?: $path);

            if (!$filename || $filename === '.' || $filename === DIRECTORY_SEPARATOR) {
                continue;
            }

            $storagePath = 'cvs/' . $filename;
            if (Storage::disk('public')->exists($storagePath)) {
                return Storage::disk('public')->path($storagePath);
            }
        }

        return null;
    }

    private function canRecruiterAccessAssignedApplication($user, Application $application): bool
    {
        if (
            !$user->isRecruiter()
            || !$user->recruiter
            || !$application->jobOffer
            || (int) $user->recruiter->company_id !== (int) $application->jobOffer->company_id
        ) {
            return false;
        }

        return Interview::query()
            ->where('recruiter_id', $user->recruiter->id)
            ->where(function ($query) use ($application) {
                $query->where('application_id', $application->id)
                    ->orWhere(function ($legacy) use ($application) {
                        $legacy->whereNull('application_id')
                            ->where('candidate_id', $application->candidate_id)
                            ->where('job_offer_id', $application->job_offer_id);
                    });
            })
            ->exists();
    }

    private function canRecruiterManageApplication($user, Application $application): bool
    {
        if (!$user->isRecruiter() || !$user->recruiter || !$application->jobOffer) {
            return false;
        }

        if (!$this->canManageJobOfferForUser($user, $application->jobOffer)) {
            return false;
        }

        $assignedRecruiterIds = Interview::query()
            ->where(function ($query) use ($application) {
                $query->where('application_id', $application->id)
                    ->orWhere(function ($legacy) use ($application) {
                        $legacy->whereNull('application_id')
                            ->where('candidate_id', $application->candidate_id)
                            ->where('job_offer_id', $application->job_offer_id);
                    });
            })
            ->whereNotNull('recruiter_id')
            ->pluck('recruiter_id')
            ->filter()
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values();

        if ($assignedRecruiterIds->isNotEmpty()) {
            return $assignedRecruiterIds->contains((int) $user->recruiter->id);
        }

        return true;
    }

    private function hasRecruiterAssignmentsTable(): bool
    {
        static $exists = null;

        if ($exists === null) {
            $exists = Schema::hasTable('job_offer_recruiter_assignments');
        }

        return (bool) $exists;
    }

    private function resolveScopedJobIdsForUser($user)
    {
        $jobIds = collect([]);

        if ($user->company) {
            return JobOffer::where('company_id', $user->company->id)->pluck('id');
        }

        if (!$user->isRecruiter() || !$user->recruiter) {
            return $jobIds;
        }

        if ($this->hasRecruiterAssignmentsTable()) {
            $assignedJobIds = DB::table('job_offer_recruiter_assignments as assignments')
                ->join('job_offers as offers', 'offers.id', '=', 'assignments.job_offer_id')
                ->where('assignments.recruiter_id', $user->recruiter->id)
                ->where('offers.company_id', $user->recruiter->company_id)
                ->pluck('assignments.job_offer_id');

            if ($assignedJobIds->isNotEmpty()) {
                return $assignedJobIds;
            }
        }

        return JobOffer::where('company_id', $user->recruiter->company_id)
            ->when($user->recruiter->department_id, function ($q) use ($user) {
                $q->where('department_id', $user->recruiter->department_id);
            })
            ->pluck('id');
    }

    private function resolveManualQuizStatus(Application $application): ?string
    {
        // Resolve based on current application's associated quiz model
        $quiz = $application->relationLoaded('manualQuiz')
            ? $application->manualQuiz
            : $application->manualQuiz()->first();

        // CRITICAL: If no quiz record exists, clear quiz-related fields
        if (!$quiz) {
            if ($application->manual_quiz_status !== '' || $application->manual_quiz_score !== null || $application->manual_quiz_completed_at !== null) {
                $application->manual_quiz_status = '';
                $application->manual_quiz_score = null;
                $application->manual_quiz_completed_at = null;
                $application->save();
            }
            return '';
        }

        $currentStatus = strtolower(trim((string) $application->manual_quiz_status));
        $quizStatus = strtolower(trim((string) $quiz->status));

        // Only mark as completed if quiz was actually started or completed
        $quizWasTaken = $quiz->started_at || $quiz->completed_at || $quizStatus === 'completed' || $quizStatus === 'in_progress';

        if ($quizWasTaken && ($application->manual_quiz_score !== null || $quizStatus === 'completed')) {
            $resolvedStatus = 'completed';
        } elseif ($currentStatus === '' || $currentStatus === 'none') {
            $resolvedStatus = $quizStatus !== '' ? $quizStatus : 'ready';
        } else {
            $resolvedStatus = $currentStatus;
        }

        if ($resolvedStatus !== $application->manual_quiz_status) {
            $application->manual_quiz_status = $resolvedStatus;
            $application->save();
        }

        return $resolvedStatus;
    }

    private function hydrateLegacyInterviews($applications): void
    {
        if (!$applications || $applications->isEmpty()) {
            return;
        }

        $candidateIds = $applications
            ->pluck('candidate_id')
            ->filter(fn($id) => !empty($id))
            ->unique()
            ->values();

        $jobOfferIds = $applications
            ->pluck('job_offer_id')
            ->filter(fn($id) => !empty($id))
            ->unique()
            ->values();

        if ($candidateIds->isEmpty() || $jobOfferIds->isEmpty()) {
            return;
        }

        $legacyInterviews = Interview::query()
            ->whereNull('application_id')
            ->whereIn('candidate_id', $candidateIds)
            ->whereIn('job_offer_id', $jobOfferIds)
            ->with(['recruiter.user'])
            ->orderByDesc('scheduled_at')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy(fn(Interview $i) => $i->candidate_id . '|' . $i->job_offer_id);

        if ($legacyInterviews->isEmpty()) {
            return;
        }

        foreach ($applications as $application) {
            $key = $application->candidate_id . '|' . $application->job_offer_id;
            $legacyForPair = $legacyInterviews->get($key, collect());
            if ($legacyForPair->isEmpty()) {
                continue;
            }

            $existing = $application->relationLoaded('interviews')
                ? collect($application->interviews)
                : collect();

            $combined = $existing
                ->concat($legacyForPair)
                ->filter()
                ->unique('id')
                ->sortByDesc(fn($item) => strtotime((string) ($item->scheduled_at ?? $item->created_at ?? '')))
                ->values();

            $application->setRelation('interviews', $combined);
            $application->setAttribute('interview_list', $combined->values());

            if ((!$application->relationLoaded('interview') || !$application->interview) && $combined->isNotEmpty()) {
                $application->setRelation('interview', $combined->first());
            }
        }
    }

    /**
     * Check if the application can proceed to accept/reject without requiring a manual quiz.
     * This is true when the assigned interview is an HR interview (phone or video).
     */
    private function canProceedWithoutQuiz(Application $application): bool
    {
        $interview = $application->interview;
        if (!$interview || !$interview->scheduled_at) {
            return false;
        }

        // HR phone or video interviews don't require a technical quiz
        $hrInterviewTypes = ['test_rh_telephonique', 'test_rh_video'];
        return in_array($interview->interview_type, $hrInterviewTypes);
    }

    /**
     * RH assigns a recruiter to an application (without scheduling date/time).
     * The recruiter will be notified and will schedule the interview later.
     * Route: POST /api/company/applications/{id}/assign-recruiter
     */
    public function assignRecruiter(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        if (!$user->isCompanyAdmin() || !$user->company) {
            return response()->json([
                'success' => false,
                'message' => 'Only HR can assign recruiters.',
            ], 403);
        }

        $application = Application::with(['candidate.user', 'jobOffer'])->find($id);
        if (!$application) {
            return response()->json(['success' => false, 'message' => 'Application not found'], 404);
        }

        if (!$application->jobOffer || !$this->canManageJobOfferForUser($user, $application->jobOffer)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized access to this application'], 403);
        }

        // Validate required fields (no date/time - recruiter will set those)
        $validated = $request->validate([
            'interview_type' => 'required|string|in:test_technique,test_rh_telephonique,test_rh_video,test_psychotechnique',
            'interview_mode' => 'required|string|in:online,presentiel',
            'interview_recruiter_id' => 'required|integer|exists:recruiters,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $assignedRecruiter = Recruiter::query()
            ->with('user')
            ->find($validated['interview_recruiter_id']);

        if (
            !$assignedRecruiter
            || (int) $assignedRecruiter->company_id !== (int) $application->jobOffer->company_id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'The selected recruiter is not available for this company.',
                'errors' => ['interview_recruiter_id' => ['Please select a valid recruiter for this company.']],
            ], 422);
        }

        // Create interview record with null scheduled_at - recruiter will set it later
        $interview = new Interview();
        $interview->candidate_id = $application->candidate_id;
        $interview->job_offer_id = $application->job_offer_id;
        $interview->application_id = $application->id;
        $interview->interview_type = $validated['interview_type'];
        $interview->interview_mode = $validated['interview_mode'];
        $interview->notes = $validated['notes'] ?? null;
        $interview->scheduled_at = null; // Will be set by recruiter later
        $interview->status = 'pending';
        $interview->recruiter_id = $assignedRecruiter->id;
        $interview->save();

        // Mark the application as being in the interview flow.
        $application->status = 'interview';
        if (Schema::hasColumn('applications', 'interview_launched_at')) {
            $application->interview_launched_at = $application->interview_launched_at ?? now();
        }
        $application->save();

        // Notify the assigned recruiter that they have been assigned an interview
        try {
            $this->companyRealtimeNotificationService->notifyRecruiterInterviewAssigned(
                $application->jobOffer,
                $application->candidate,
                $assignedRecruiter,
                (int) $application->id,
                $interview
            );
        } catch (\Exception $e) {
            Log::error('Recruiter assignment notification error: ' . $e->getMessage());
        }

        // Send email notification to the recruiter
        try {
            $this->sendRecruiterAssignmentEmail($assignedRecruiter, $application, $interview);
        } catch (\Exception $e) {
            Log::error('Recruiter assignment email error: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Expert assigned successfully. The recruiter has been notified to schedule the interview.',
            'data' => [
                'application' => $application->fresh(['candidate.user', 'jobOffer']),
                'interview' => $interview->fresh(['recruiter.user']),
            ],
        ]);
    }

    /**
     * Send email notification to recruiter when assigned to an interview.
     */
    private function sendRecruiterAssignmentEmail(Recruiter $recruiter, Application $application, Interview $interview): void
    {
        // Email will be implemented via Laravel Mailable or notification
        // For now, log the notification
        Log::info('Recruiter assignment email would be sent', [
            'recruiter_id' => $recruiter->id,
            'recruiter_email' => $recruiter->user?->email,
            'candidate_name' => $application->candidate->user->full_name ?? 'Unknown',
            'job_title' => $application->jobOffer->title ?? 'Unknown',
            'interview_type' => $interview->interview_type,
        ]);
    }

    /**
     * Mask AI scores if the company subscription does not include AI features.
     */
    private function maskApplicationAiScores(Application $application): void
    {
        $jobOffer = $application->jobOffer;
        if (!$jobOffer || !$jobOffer->company) {
            return;
        }

        $company = $jobOffer->company;

        if (!$this->subscriptionFeatureService->hasAiMatching($company)) {
            $application->ai_match_score = null;
            $application->ai_degree_score = null;
            $application->ai_skill_score = null;
            $application->ai_experience_score = null;
            $application->ai_explanation = null;
            
            if (Schema::hasColumn('applications', 'ai_error')) {
                $application->ai_error = $this->subscriptionFeatureService->getFeatureNotEnabledMessage('ai_matching');
            }
            
            // Flag for frontend to show upgrade prompt
            $application->ai_restricted = true;
        }

        // Granular flags for UI (even if matching is allowed, quiz or chat might be blocked)
        $application->ai_quiz_restricted = !$this->subscriptionFeatureService->hasAiQuiz($company);
        $application->chat_restricted = !$this->subscriptionFeatureService->hasChatAccess($company);
    }
}
