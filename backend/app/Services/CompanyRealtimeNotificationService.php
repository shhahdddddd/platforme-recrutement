<?php

namespace App\Services;

use App\Events\UserNotificationCreated;
use App\Jobs\SendPushNotificationJob;
use App\Models\BinomeInvitation;
use App\Models\Candidate;
use App\Models\Interview;
use App\Models\JobOffer;
use App\Models\Notification;
use App\Models\Recruiter;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class CompanyRealtimeNotificationService
{
    public function notifyKBDocumentProcessed(int $companyId, string $filename, int $chunkCount): void
    {
        try {
            $company = \App\Models\Company::find($companyId);
            if (!$company || !$company->user) {
                return;
            }

            $title = 'Document processed';
            $body = "Your document [{$filename}] has been processed. {$chunkCount} content sections indexed and available for quiz generation.";

            $this->deliverNotificationToUser(
                $company->user,
                'KB_DOCUMENT_READY',
                $companyId,
                $title,
                $body,
                [
                    'type' => 'KB_DOCUMENT_READY',
                    'filename' => $filename,
                    'chunk_count' => (string) $chunkCount,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyKBDocumentProcessed failed: ' . $e->getMessage());
        }
    }

    public function notifyJobLikedByCandidate(JobOffer $jobOffer, User $actor): void
    {
        try {
            if (!$jobOffer->company) {
                return;
            }

            $companyUser = $jobOffer->company->user;
            if (!$companyUser || $companyUser->id === $actor->id) {
                return;
            }

            $actorName = $this->resolveActorName($actor);
            $title = 'New job like';
            $body = "{$actorName} liked your job offer: {$jobOffer->title}";

            $this->deliverNotificationToUser(
                $companyUser,
                'JOB_LIKED',
                (int) $jobOffer->id,
                $title,
                $body,
                [
                    'type' => 'JOB_LIKED',
                    'job_offer_id' => (string) $jobOffer->id,
                    'actor_user_id' => (string) $actor->id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyJobLikedByCandidate failed: ' . $e->getMessage());
        }
    }

    public function notifyJobCommentedByCandidate(JobOffer $jobOffer, User $actor, string $commentPreview): void
    {
        try {
            if (!$jobOffer->company) {
                return;
            }

            $companyUser = $jobOffer->company->user;
            if (!$companyUser || $companyUser->id === $actor->id) {
                return;
            }

            $actorName = $this->resolveActorName($actor);
            $title = 'New job comment';
            $body = "{$actorName} commented on {$jobOffer->title}: {$commentPreview}";

            $this->deliverNotificationToUser(
                $companyUser,
                'JOB_COMMENTED',
                (int) $jobOffer->id,
                $title,
                $body,
                [
                    'type' => 'JOB_COMMENTED',
                    'job_offer_id' => (string) $jobOffer->id,
                    'actor_user_id' => (string) $actor->id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyJobCommentedByCandidate failed: ' . $e->getMessage());
        }
    }

    public function notifyJobPostedToCandidates(JobOffer $jobOffer): void
    {
        try {
            $companyName = $jobOffer->company?->name ?: 'A company';
            $title = 'New job opportunity';
            $body = "{$companyName} posted: {$jobOffer->title}";

            User::whereRaw('LOWER(role) IN (?, ?)', ['candidate', 'candidat'])
                ->whereHas('fcmTokens')
                ->chunkById(200, function ($candidateUsers) use ($jobOffer, $title, $body) {
                    foreach ($candidateUsers as $candidateUser) {
                        $this->deliverNotificationToUser(
                            $candidateUser,
                            'JOB_POSTED',
                            (int) $jobOffer->id,
                            $title,
                            $body,
                            [
                                'type' => 'JOB_POSTED',
                                'job_offer_id' => (string) $jobOffer->id,
                            ]
                        );
                    }
                });
        } catch (\Throwable $e) {
            Log::error('notifyJobPostedToCandidates failed: ' . $e->getMessage());
        }
    }

    public function notifyJobPostedToRecruiters(JobOffer $jobOffer): void
    {
        try {
            if (!$jobOffer->company_id || !$jobOffer->department_id) {
                return;
            }

            $title = 'New department job offer';
            $body = "A new job offer '{$jobOffer->title}' has been posted in your department.";

            // Find all recruiters in that department
            $recruiters = User::whereHas('recruiter', function ($query) use ($jobOffer) {
                $query->where('company_id', $jobOffer->company_id)
                      ->where('department_id', $jobOffer->department_id);
            })->get();

            foreach ($recruiters as $recruiter) {
                $this->deliverNotificationToUser(
                    $recruiter,
                    'JOB_POSTED',
                    (int) $jobOffer->id,
                    $title,
                    $body,
                    [
                        'type' => 'JOB_POSTED',
                        'job_offer_id' => (string) $jobOffer->id,
                    ]
                );
            }
        } catch (\Throwable $e) {
            Log::error('notifyJobPostedToRecruiters failed: ' . $e->getMessage());
        }
    }

    public function notifyCandidateProfileUpdated(Candidate $candidate): void
    {
        $candidateId = (int) $candidate->id;
        $cacheKey = "notif_profile_updated_{$candidateId}";

        // Skip if we already sent a profile update alert for this candidate in the last hour
        if (\Illuminate\Support\Facades\Cache::has($cacheKey)) {
            return;
        }

        $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
        if ($candidateName === '') {
            $candidateName = $candidate->user?->email ?? 'A candidate';
        }

        $title = 'Talent Insight: Profile Refined';
        $body = "{$candidateName} has enhanced their profile with new skills or experience. Check it out to see if they match your needs.";

        $this->notifyAllActiveCompanies($title, $body, 'CANDIDATE_PROFILE_UPDATED', $candidateId);

        // Set cooldown for 1 hour
        \Illuminate\Support\Facades\Cache::put($cacheKey, true, now()->addHour());
    }

    public function notifyJobApplicationSubmitted(JobOffer $jobOffer, Candidate $candidate, int $applicationId): void
    {
        try {
            $candidatesToNotify = collect();

            // 1. Notify the Company Owner
            $ownerUser = $this->resolveJobOwnerUser($jobOffer);
            if ($ownerUser) {
                $candidatesToNotify->push($ownerUser);
            }

            // 2. Notify all Recruiters of this company
            if ($jobOffer->company_id) {
                $recruiters = User::whereHas('recruiter', function ($query) use ($jobOffer) {
                    $query->where('company_id', $jobOffer->company_id);
                    // Optionally filter by department if recruitment is decentralized
                    if ($jobOffer->department_id) {
                        $query->where(function($q) use ($jobOffer) {
                            $q->whereNull('department_id')
                              ->orWhere('department_id', $jobOffer->department_id);
                        });
                    }
                })->get();

                foreach ($recruiters as $recruiter) {
                    $candidatesToNotify->push($recruiter);
                }
            }

            $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($candidateName === '') {
                $candidateName = $candidate->user?->email ?? 'A candidate';
            }

            $title = 'New application';
            $body = "{$candidateName} applied for: {$jobOffer->title}";

            // Deliver to unique users
            $candidatesToNotify->unique('id')->each(function ($recipient) use ($applicationId, $title, $body, $jobOffer) {
                $this->deliverNotificationToUser(
                    $recipient,
                    'NEW_APPLICATION',
                    $applicationId,
                    $title,
                    $body,
                    [
                        'type' => 'NEW_APPLICATION',
                        'application_id' => (string) $applicationId,
                        'job_offer_id' => (string) $jobOffer->id,
                    ]
                );
            });
        } catch (\Throwable $e) {
            Log::error('notifyJobApplicationSubmitted failed: ' . $e->getMessage());
        }
    }

    public function notifyInterviewLaunched(JobOffer $jobOffer, Candidate $candidate, int $applicationId, string $interviewType, string $scheduledAt): void
    {
        try {
            $candidateUser = $candidate->user;
            if (!$candidateUser) {
                return;
            }

            $dateFormatted = \Carbon\Carbon::parse($scheduledAt)->format('d/m/Y à H:i');
            $companyName = $jobOffer->company?->name ?: 'A company';
            $title = 'Felicitations ! Entretien planifié';
            $body = "Bonne nouvelle ! {$companyName} a accepté votre candidature pour le poste '{$jobOffer->title}' et a planifié un {$interviewType} le {$dateFormatted}. Consultez l'application pour plus de détails.";

            $this->deliverNotificationToUser(
                $candidateUser,
                'INTERVIEW_SCHEDULED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'INTERVIEW_SCHEDULED',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyInterviewLaunched failed: ' . $e->getMessage());
        }
    }

    public function notifyRecruiterInterviewAssigned(
        JobOffer $jobOffer,
        Candidate $candidate,
        Recruiter $recruiter,
        int $applicationId,
        Interview $interview
    ): void {
        try {
            $recruiterUser = $recruiter->user;
            if (!$recruiterUser) {
                return;
            }

            $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($candidateName === '') {
                $candidateName = $candidate->user?->email ?? 'The candidate';
            }

            $typeLabel = $this->formatInterviewTypeLabel((string) $interview->interview_type);
            $title = 'Interview assignment';
            $scheduledAtLabel = $interview->scheduled_at
                ? $this->formatInterviewDateLabel($interview->scheduled_at)
                : 'the scheduled slot set by HR';
            $body = "You were assigned to handle the {$typeLabel} interview for {$candidateName} on '{$jobOffer->title}'. HR scheduled it for {$scheduledAtLabel}. Review it from your recruiter dashboard.";

            $this->deliverNotificationToUser(
                $recruiterUser,
                'INTERVIEW_ASSIGNED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'INTERVIEW_ASSIGNED',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                    'interview_id' => (string) $interview->id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyRecruiterInterviewAssigned failed: ' . $e->getMessage());
        }
    }

    public function notifyInterviewScheduled(
        JobOffer $jobOffer,
        Candidate $candidate,
        int $applicationId,
        Interview $interview
    ): void {
        try {
            $candidateUser = $candidate->user;
            if (!$candidateUser || !$interview->scheduled_at) {
                return;
            }

            $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($candidateName === '') {
                $candidateName = $candidateUser->email ?? 'Candidate';
            }

            $companyName = $jobOffer->company?->name ?: 'A company';
            $typeLabel = $this->formatInterviewTypeLabel((string) $interview->interview_type);
            $modeLabel = $this->formatInterviewModeLabel((string) $interview->interview_mode);
            $scheduledAtLabel = $this->formatInterviewDateLabel($interview->scheduled_at);

            $title = 'Interview scheduled';
            $body = "{$companyName} scheduled your {$typeLabel} interview for '{$jobOffer->title}' on {$scheduledAtLabel}. Open the app for the latest details.";

            $this->deliverNotificationToUser(
                $candidateUser,
                'INTERVIEW_SCHEDULED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'INTERVIEW_SCHEDULED',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                    'interview_id' => (string) $interview->id,
                ]
            );

            try {
                \Illuminate\Support\Facades\Mail::to($candidateUser->email)
                    ->send(new \App\Mail\InterviewScheduledMail(
                        $candidateName,
                        $jobOffer->title ?? 'the position',
                        $companyName,
                        $typeLabel,
                        $modeLabel,
                        $scheduledAtLabel,
                        $interview->duration_minutes !== null ? (int) $interview->duration_minutes : null,
                        $interview->notes ? trim((string) $interview->notes) : null
                    ));

                Log::info('Interview scheduling email sent', [
                    'candidate_user_id' => $candidateUser->id,
                    'application_id' => $applicationId,
                    'interview_id' => $interview->id,
                    'scheduled_at' => $interview->scheduled_at?->toIso8601String(),
                ]);
            } catch (\Throwable $mailError) {
                Log::warning('Failed to send interview scheduling email (push notification was still sent)', [
                    'error' => $mailError->getMessage(),
                    'candidate_user_id' => $candidateUser->id,
                    'application_id' => $applicationId,
                    'interview_id' => $interview->id,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('notifyInterviewScheduled failed: ' . $e->getMessage());
        }
    }

    public function notifyQuizDraftReady(JobOffer $jobOffer, int $applicationId): void
    {
        try {
            $recipients = collect();

            $ownerUser = $this->resolveJobOwnerUser($jobOffer);
            if ($ownerUser) {
                $recipients->push($ownerUser);
            }

            if ($jobOffer->company_id) {
                $recruiters = User::whereHas('recruiter', function ($query) use ($jobOffer) {
                    $query->where('company_id', $jobOffer->company_id);
                })->get();

                foreach ($recruiters as $recruiter) {
                    $recipients->push($recruiter);
                }
            }

            $title = 'Quiz draft ready';
            $body = "The AI generated a draft assessment for '{$jobOffer->title}'. Review it before sending it to the candidate.";

            $recipients->unique('id')->each(function ($recipient) use ($applicationId, $jobOffer, $title, $body) {
                $this->deliverNotificationToUser(
                    $recipient,
                    'QUIZ_DRAFT_READY',
                    $applicationId,
                    $title,
                    $body,
                    [
                        'type' => 'QUIZ_DRAFT_READY',
                        'application_id' => (string) $applicationId,
                        'job_offer_id' => (string) $jobOffer->id,
                    ]
                );
            });
        } catch (\Throwable $e) {
            Log::error('notifyQuizDraftReady failed: ' . $e->getMessage());
        }
    }

    public function notifyQuizReadyToCandidate(
        JobOffer $jobOffer,
        Candidate $candidate,
        int $applicationId,
        string $sessionId,
        $deadline = null,
        string $quizType = 'ai' // 'ai' or 'manual'
    ) {
        try {
            $candidateUser = $candidate->user;
            Log::info('notifyQuizReadyToCandidate: Checking candidate user', [
                'candidate_id' => $candidate->id ?? null,
                'has_user' => $candidateUser ? true : false,
                'user_id' => $candidateUser?->id,
                'quiz_type' => $quizType,
            ]);
            if (!$candidateUser || !$candidateUser->id) {
                Log::warning('notifyQuizReadyToCandidate: Candidate has no user', ['candidate_id' => $candidate->id ?? null]);
                return;
            }

            $jobTitle = $jobOffer->title ?? 'the position';
            $companyName = $jobOffer->company?->name ?? 'the company';

            // Push notification - different title/body based on quiz type
            if ($quizType === 'manual') {
                $title = 'Manual Quiz Ready';
                $body = "Your manual technical quiz for {$jobTitle} at {$companyName} is ready. Please complete it at your earliest convenience.";
                $notificationType = 'MANUAL_QUIZ_READY';
            } else {
                $title = 'AI Technical Assessment Ready';
                $body = "Your AI-generated technical assessment for {$jobTitle} at {$companyName} is ready. The quiz was personalized based on the job requirements and company knowledge base. You can start when you're prepared.";
                $notificationType = 'QUIZ_READY';
            }

            $this->deliverNotificationToUser(
                $candidateUser,
                $notificationType,
                $applicationId,
                $title,
                $body,
                [
                    'type' => $notificationType,
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) ($jobOffer->id ?? ''),
                    'company_name' => $companyName,
                    'job_title' => $jobTitle,
                    'quiz_type' => $quizType,
                ]
            );

            Log::info('notifyQuizReadyToCandidate: Sending notifications', [
                'application_id' => $applicationId,
                'candidate_user_id' => $candidateUser->id,
                'email' => $candidateUser->email ?? 'none',
                'quiz_type' => $quizType,
            ]);

            // Email notification
            $this->sendQuizReadyEmail($candidateUser, $applicationId, $jobTitle, $companyName, $quizType);

        } catch (Throwable $e) {
            Log::error('Failed to notify candidate quiz ready', [
                'application_id' => $applicationId,
                'candidate_id' => $candidate->id ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function sendQuizReadyEmail(User $candidate, int $applicationId, string $jobTitle, string $companyName, string $quizType = 'ai'): void
    {
        try {
            if (empty($candidate->email)) {
                return;
            }

            $emailData = [
                'candidate_name' => $candidate->first_name ?? $candidate->name ?? 'Candidate',
                'job_title' => $jobTitle,
                'company_name' => $companyName,
                'application_id' => $applicationId,
                'assessment_url' => config('app.frontend_url') . '/candidate/assessment/' . $applicationId,
                'quiz_type' => $quizType,
            ];

            // Queue email sending
            \Illuminate\Support\Facades\Mail::to($candidate->email)
                ->queue(new \App\Mail\QuizReadyMail($emailData));

            Log::info('Quiz ready email queued', [
                'candidate_id' => $candidate->id,
                'application_id' => $applicationId,
                'email' => $candidate->email,
                'quiz_type' => $quizType,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to queue quiz ready email', [
                'candidate_id' => $candidate->id ?? null,
                'application_id' => $applicationId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function notifyQuizCompletedToCandidate(JobOffer $jobOffer, Candidate $candidate, int $applicationId, float $score): void
    {
        try {
            $candidateUser = $candidate->user;
            if (!$candidateUser) {
                return;
            }

            $title = 'Quiz score available';
            $body = "Your assessment for '{$jobOffer->title}' has been scored. Open the app to review your result.";

            $this->deliverNotificationToUser(
                $candidateUser,
                'QUIZ_COMPLETED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'QUIZ_COMPLETED',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                    'total_score' => (string) round($score, 2),
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyQuizCompletedToCandidate failed: ' . $e->getMessage());
        }
    }

    public function notifyQuizCompletedToRecruiter(
        JobOffer $jobOffer,
        Candidate $candidate,
        \App\Models\Recruiter $recruiter,
        int $applicationId,
        float $score,
        bool $isAiQuiz = false
    ): void {
        try {
            $recruiterUser = $recruiter->user;
            if (!$recruiterUser) {
                return;
            }

            $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($candidateName === '') {
                $candidateName = $candidate->user?->email ?? 'The candidate';
            }

            $quizType = $isAiQuiz ? 'AI quiz' : 'Manual quiz';
            $title = "$quizType completed";
            $body = "{$candidateName} finished the $quizType assessment for '{$jobOffer->title}' with a score of " . round($score, 2) . '%.';

            $this->deliverNotificationToUser(
                $recruiterUser,
                'QUIZ_COMPLETED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'QUIZ_COMPLETED',
                    'quiz_type' => $isAiQuiz ? 'ai' : 'manual',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                    'candidate_name' => $candidateName,
                    'total_score' => (string) round($score, 2),
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyQuizCompletedToRecruiter failed: ' . $e->getMessage());
        }
    }

    public function notifyApplicationRejected(
        \App\Models\JobOffer $jobOffer,
        \App\Models\Candidate $candidate,
        int $applicationId
    ): void {
        try {
            $candidateUser = $candidate->user;
            if (!$candidateUser) {
                return;
            }

            $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($candidateName === '') {
                $candidateName = $candidateUser->email ?? 'Candidate';
            }

            $companyName = $jobOffer->company?->name ?: 'The company';
            $title = 'Candidature non retenue';
            $body = "Nous sommes désolés, votre candidature pour le poste '{$jobOffer->title}' chez {$companyName} n'a pas été retenue. Consultez d'autres offres sur RecrutiTN.";

            // 1. Send Push Notification (Flutter app)
            $this->deliverNotificationToUser(
                $candidateUser,
                'APPLICATION_REJECTED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'APPLICATION_REJECTED',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                ]
            );

            // 2. Send Rejection Email
            try {
                \Illuminate\Support\Facades\Mail::to($candidateUser->email)
                    ->send(new \App\Mail\ApplicationRejectedMail(
                        $candidateName,
                        $jobOffer->title ?? 'the position',
                        $companyName
                    ));

                Log::info('Rejection email sent', [
                    'candidate_user_id' => $candidateUser->id,
                    'application_id' => $applicationId,
                ]);
            } catch (\Throwable $mailError) {
                Log::warning('Failed to send rejection email (push notification was still sent)', [
                    'error' => $mailError->getMessage(),
                    'candidate_user_id' => $candidateUser->id,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('notifyApplicationRejected failed: ' . $e->getMessage());
        }
    }

    public function notifyApplicationAccepted(
        \App\Models\JobOffer $jobOffer,
        \App\Models\Candidate $candidate,
        int $applicationId
    ): void {
        try {
            $candidateUser = $candidate->user;
            if (!$candidateUser) {
                return;
            }

            $companyName = $jobOffer->company?->name ?: 'The company';
            $title = 'Application accepted';
            $body = "Your application for '{$jobOffer->title}' at {$companyName} has been accepted. Open the app for the latest status.";

            // 1. Deliver Push Notification
            $this->deliverNotificationToUser(
                $candidateUser,
                'APPLICATION_ACCEPTED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'APPLICATION_ACCEPTED',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                ]
            );

            // 2. Deliver Professional Acceptance Email
            try {
                $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
                if ($candidateName === '') {
                    $candidateName = $candidateUser->email ?? 'Candidate';
                }

                \Illuminate\Support\Facades\Mail::to($candidateUser->email)
                    ->send(new \App\Mail\ApplicationAcceptedMail(
                        $candidateName,
                        $jobOffer->title ?? 'the position',
                        $companyName
                    ));

                Log::info('Acceptance email sent', [
                    'candidate_user_id' => $candidateUser->id,
                    'application_id' => $applicationId,
                ]);
            } catch (\Throwable $mailError) {
                Log::warning('Failed to send acceptance email (push notification was still sent)', [
                    'error' => $mailError->getMessage(),
                    'candidate_user_id' => $candidateUser->id,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('notifyApplicationAccepted failed: ' . $e->getMessage());
        }
    }

    public function notifyInternChatMessage(
        JobOffer $jobOffer,
        Candidate $candidate,
        Recruiter $recruiter,
        int $applicationId,
        string $messagePreview
    ): void {
        try {
            $candidateUser = $candidate->user;
            if (!$candidateUser) {
                return;
            }

            $recruiterName = trim(($recruiter->first_name ?? '') . ' ' . ($recruiter->last_name ?? ''));
            if ($recruiterName === '') {
                $recruiterName = $recruiter->user?->email ?? 'Your recruiter';
            }

            $companyName = $jobOffer->company?->name ?: 'the company';
            $title = 'New message from recruiter';
            $body = "{$recruiterName} sent you a message about '{$jobOffer->title}' at {$companyName}: " . Str::limit(trim($messagePreview), 120);

            $this->deliverNotificationToUser(
                $candidateUser,
                'INTERN_CHAT_MESSAGE',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'INTERN_CHAT_MESSAGE',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                    'sender_role' => 'recruiter',
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyInternChatMessage failed: ' . $e->getMessage());
        }
    }

    public function notifyRecruiterInternChatMessage(
        JobOffer $jobOffer,
        Recruiter $recruiter,
        Candidate $candidate,
        int $applicationId,
        string $messagePreview
    ): void {
        try {
            $recruiterUser = $recruiter->user;
            if (!$recruiterUser) {
                return;
            }

            $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($candidateName === '') {
                $candidateName = $candidate->user?->email ?? 'The candidate';
            }

            $title = 'New candidate message';
            $body = "{$candidateName} sent a message about '{$jobOffer->title}': " . Str::limit(trim($messagePreview), 120);

            $this->deliverNotificationToUser(
                $recruiterUser,
                'INTERN_CHAT_MESSAGE',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'INTERN_CHAT_MESSAGE',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                    'sender_role' => 'candidate',
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyRecruiterInternChatMessage failed: ' . $e->getMessage());
        }
    }

    public function notifyBinomeInvitation(
        BinomeInvitation $invitation,
        Candidate $inviter,
        Candidate $invited
    ): void {
        try {
            $recipient = $invited->user;
            if (!$recipient) {
                return;
            }

            $inviterName = trim(($inviter->first_name ?? '') . ' ' . ($inviter->last_name ?? ''));
            if ($inviterName === '') {
                $inviterName = $inviter->user?->email ?? 'A candidate';
            }

            $jobTitle = $invitation->application?->jobOffer?->title ?? 'this internship';
            $title = 'New binome invitation';
            $body = "{$inviterName} invited you to join as binome for '{$jobTitle}'.";

            $this->deliverNotificationToUser(
                $recipient,
                'BINOME_INVITATION',
                (int) $invitation->id,
                $title,
                $body,
                [
                    'type' => 'BINOME_INVITATION',
                    'invitation_id' => (string) $invitation->id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyBinomeInvitation failed: ' . $e->getMessage());
        }
    }

    public function notifyAttendanceScheduleUpdated(
        JobOffer $jobOffer,
        Candidate $candidate,
        int $applicationId,
        string $attendanceType,
        ?array $attendanceSchedule = null
    ): void {
        try {
            $candidateUser = $candidate->user;
            if (!$candidateUser) {
                return;
            }

            $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($candidateName === '') {
                $candidateName = $candidateUser->email ?? 'Candidate';
            }

            $companyName = $jobOffer->company?->name ?: 'The company';
            $attendanceTypeLabel = ucfirst($attendanceType);

            if ($attendanceType === 'hybrid' && $attendanceSchedule && !empty($attendanceSchedule['days'])) {
                $days = implode(', ', $attendanceSchedule['days']);
                $startTime = isset($attendanceSchedule['start_time']) ? \Carbon\Carbon::parse($attendanceSchedule['start_time'])->format('h:i A') : '';
                $endTime = isset($attendanceSchedule['end_time']) ? \Carbon\Carbon::parse($attendanceSchedule['end_time'])->format('h:i A') : '';
                $scheduleInfo = " on {$days} from {$startTime} to {$endTime}";
            } else {
                $scheduleInfo = '';
            }

            $title = 'Attendance Schedule Updated';
            $body = "Your attendance for '{$jobOffer->title}' at {$companyName} has been set to {$attendanceTypeLabel}{$scheduleInfo}. Check your email for full details.";

            // 1. Send Push Notification
            $this->deliverNotificationToUser(
                $candidateUser,
                'ATTENDANCE_SCHEDULE_UPDATED',
                $applicationId,
                $title,
                $body,
                [
                    'type' => 'ATTENDANCE_SCHEDULE_UPDATED',
                    'application_id' => (string) $applicationId,
                    'job_offer_id' => (string) $jobOffer->id,
                    'attendance_type' => $attendanceType,
                    'attendance_schedule' => $attendanceSchedule ? json_encode($attendanceSchedule) : null,
                ]
            );

            // 2. Send Email
            try {
                \Illuminate\Support\Facades\Mail::to($candidateUser->email)
                    ->send(new \App\Mail\AttendanceScheduleMail(
                        $candidateName,
                        $companyName,
                        $jobOffer->title ?? 'the position',
                        $attendanceType,
                        $attendanceSchedule
                    ));

                Log::info('Attendance schedule email sent', [
                    'candidate_user_id' => $candidateUser->id,
                    'application_id' => $applicationId,
                    'attendance_type' => $attendanceType,
                ]);
            } catch (\Throwable $mailError) {
                Log::warning('Failed to send attendance schedule email (push notification was still sent)', [
                    'error' => $mailError->getMessage(),
                    'candidate_user_id' => $candidateUser->id,
                    'application_id' => $applicationId,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('notifyAttendanceScheduleUpdated failed: ' . $e->getMessage());
        }
    }

    public function notifyBinomeInvitationAccepted(
        BinomeInvitation $invitation,
        Candidate $inviter,
        Candidate $invited
    ): void {
        try {
            $recipient = $inviter->user;
            if (!$recipient) {
                return;
            }

            $acceptedBy = trim(($invited->first_name ?? '') . ' ' . ($invited->last_name ?? ''));
            if ($acceptedBy === '') {
                $acceptedBy = $invited->user?->email ?? 'Your invited candidate';
            }

            $jobTitle = $invitation->application?->jobOffer?->title ?? 'this internship';
            $title = 'Binome invitation accepted';
            $body = "{$acceptedBy} accepted your binome invitation for '{$jobTitle}'.";

            $this->deliverNotificationToUser(
                $recipient,
                'BINOME_INVITATION_ACCEPTED',
                (int) $invitation->id,
                $title,
                $body,
                [
                    'type' => 'BINOME_INVITATION_ACCEPTED',
                    'invitation_id' => (string) $invitation->id,
                    'application_id' => (string) $invitation->application_id,
                    'job_offer_id' => (string) ($invitation->application?->job_offer_id ?? 0),
                    'invited_candidate_id' => (string) $invited->id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyBinomeInvitationAccepted failed: ' . $e->getMessage());
        }
    }

    public function notifyBinomeInvitationRejected(
        BinomeInvitation $invitation,
        Candidate $inviter,
        Candidate $invited
    ): void {
        try {
            $recipient = $inviter->user;
            if (!$recipient) {
                return;
            }

            $rejectedBy = trim(($invited->first_name ?? '') . ' ' . ($invited->last_name ?? ''));
            if ($rejectedBy === '') {
                $rejectedBy = $invited->user?->email ?? 'Your invited candidate';
            }

            $jobTitle = $invitation->application?->jobOffer?->title ?? 'this internship';
            $title = 'Binome invitation declined';
            $body = "{$rejectedBy} declined your binome invitation for '{$jobTitle}'.";

            $this->deliverNotificationToUser(
                $recipient,
                'BINOME_INVITATION_REJECTED',
                (int) $invitation->id,
                $title,
                $body,
                [
                    'type' => 'BINOME_INVITATION_REJECTED',
                    'invitation_id' => (string) $invitation->id,
                    'application_id' => (string) $invitation->application_id,
                    'job_offer_id' => (string) ($invitation->application?->job_offer_id ?? 0),
                    'invited_candidate_id' => (string) $invited->id,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('notifyBinomeInvitationRejected failed: ' . $e->getMessage());
        }
    }

    private function notifyAllActiveCompanies(string $title, string $body, string $type, int $referenceId): void
    {
        try {
            $today = now()->toDateString();

            $companyUsers = User::whereHas('company.subscriptions', function ($query) use ($today) {
                $query->where('status', 'Active')
                    ->whereDate('start_date', '<=', $today)
                    ->whereDate('end_date', '>', $today);
            })->get();

            foreach ($companyUsers as $companyUser) {
                $this->deliverNotificationToUser(
                    $companyUser,
                    $type,
                    $referenceId,
                    $title,
                    $body,
                    [
                        'type' => $type,
                        'reference_id' => (string) $referenceId,
                    ]
                );
            }
        } catch (\Throwable $e) {
            Log::error('notifyAllActiveCompanies failed: ' . $e->getMessage());
        }
    }

    private function resolveActorName(User $actor): string
    {
        $candidate = $actor->candidate;
        if ($candidate) {
            $fullName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            if ($fullName !== '') {
                return $fullName;
            }
        }

        $company = $actor->company;
        if ($company && !empty($company->name)) {
            return $company->name;
        }

        return $actor->email ?? 'A user';
    }

    private function resolveJobOwnerUser(JobOffer $jobOffer): ?User
    {
        if ($jobOffer->company?->user) {
            return $jobOffer->company->user;
        }

        return null;
    }

    private function deliverNotificationToUser(
        User $recipient,
        string $type,
        int $referenceId,
        string $title,
        string $body,
        array $data
    ): void
    {
        $notification = Notification::create([
            'user_id' => $recipient->id,
            'title' => $title,
            'type' => $type,
            'reference_id' => $referenceId,
            'channel' => 'push',
            'message' => $body,
            'data' => $data,
            'is_read' => false,
            'sent_at' => now(),
            'status' => 'pending',
        ]);

        DB::afterCommit(function () use ($notification, $recipient, $title, $body, $data) {
            $freshNotification = Notification::query()->find($notification->id);
            if ($freshNotification) {
                event(new UserNotificationCreated($freshNotification, (int) $recipient->id));
            }

            if ($this->shouldForceSyncNotifications()) {
                SendPushNotificationJob::dispatchSync(
                    (int) $notification->id,
                    (int) $recipient->id,
                    $title,
                    $body,
                    $data
                );
                return;
            }

            SendPushNotificationJob::dispatch(
                (int) $notification->id,
                (int) $recipient->id,
                $title,
                $body,
                $data
            )->onQueue('notifications');
        });
    }

    /**
     * Notify recruiters when a job offer is updated by HR.
     */
    public function notifyJobUpdatedToRecruiters(JobOffer $jobOffer, array $changedFields = []): void
    {
        try {
            if (!$jobOffer->company_id) {
                return;
            }

            $title = 'Job offer updated';
            $changesText = empty($changedFields) ? '' : ' (' . implode(', ', $changedFields) . ')';
            $body = "The job offer '{$jobOffer->title}' has been updated by HR{$changesText}.";

            // Find all recruiters assigned to this job or in the department
            $recruiters = $this->getRecruitersForJobOffer($jobOffer);

            foreach ($recruiters as $recruiter) {
                $this->deliverNotificationToUser(
                    $recruiter,
                    'JOB_UPDATED',
                    (int) $jobOffer->id,
                    $title,
                    $body,
                    [
                        'type' => 'JOB_UPDATED',
                        'job_offer_id' => (string) $jobOffer->id,
                        'changed_fields' => $changedFields,
                    ]
                );
            }
        } catch (\Throwable $e) {
            Log::error('notifyJobUpdatedToRecruiters failed: ' . $e->getMessage());
        }
    }

    /**
     * Notify recruiters when a job offer is deleted by HR.
     */
    public function notifyJobDeletedToRecruiters(int $companyId, string $jobTitle, int $jobId): void
    {
        try {
            $title = 'Job offer deleted';
            $body = "The job offer '{$jobTitle}' has been deleted by HR.";

            // Find all recruiters in the company
            $recruiters = User::whereHas('recruiter', function ($query) use ($companyId) {
                $query->where('company_id', $companyId);
            })->get();

            foreach ($recruiters as $recruiter) {
                $this->deliverNotificationToUser(
                    $recruiter,
                    'JOB_DELETED',
                    $jobId,
                    $title,
                    $body,
                    [
                        'type' => 'JOB_DELETED',
                        'job_offer_id' => (string) $jobId,
                    ]
                );
            }
        } catch (\Throwable $e) {
            Log::error('notifyJobDeletedToRecruiters failed: ' . $e->getMessage());
        }
    }

    /**
     * Get all recruiters associated with a job offer (assigned or in department).
     */
    private function getRecruitersForJobOffer(JobOffer $jobOffer): \Illuminate\Support\Collection
    {
        $recruiterIds = collect();

        // Get recruiters directly assigned to this job
        if (Schema::hasTable('job_offer_recruiter_assignments')) {
            $assignedRecruiterIds = DB::table('job_offer_recruiter_assignments')
                ->where('job_offer_id', $jobOffer->id)
                ->pluck('recruiter_id');
            $recruiterIds = $recruiterIds->merge($assignedRecruiterIds);
        }

        // Get recruiters in the same department
        if ($jobOffer->department_id) {
            $departmentRecruiterIds = DB::table('recruiters')
                ->where('company_id', $jobOffer->company_id)
                ->where('department_id', $jobOffer->department_id)
                ->pluck('user_id');
            $recruiterIds = $recruiterIds->merge($departmentRecruiterIds);
        }

        return User::whereIn('id', $recruiterIds->unique())->get();
    }

    private function shouldForceSyncNotifications(): bool
    {
        return app()->environment('local') && config('queue.default') !== 'sync';
    }

    private function formatInterviewTypeLabel(string $raw): string
    {
        return match (strtolower(trim($raw))) {
            'test_technique' => 'technical',
            'test_rh_telephonique' => 'HR phone',
            'test_rh_video' => 'HR video',
            'test_psychotechnique' => 'psychometric',
            default => trim(str_replace('_', ' ', $raw)) ?: 'interview',
        };
    }

    private function formatInterviewModeLabel(string $raw): string
    {
        return match (strtolower(trim($raw))) {
            'presentiel', 'in_person', 'onsite' => 'in person',
            'online' => 'online',
            default => trim(str_replace('_', ' ', $raw)) ?: 'not specified',
        };
    }

    private function formatInterviewDateLabel(Carbon|string|null $scheduledAt): string
    {
        if ($scheduledAt instanceof Carbon) {
            return $scheduledAt->copy()->format('d/m/Y H:i');
        }

        if (is_string($scheduledAt) && trim($scheduledAt) !== '') {
            return Carbon::parse($scheduledAt)->format('d/m/Y H:i');
        }

        return 'Date not set';
    }
}
