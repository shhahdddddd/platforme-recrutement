<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\BinomeInvitation;
use App\Models\Candidate;
use App\Models\InternChatConversation;
use App\Models\User;
use App\Services\CompanyRealtimeNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class BinomeController extends Controller
{
    public function __construct(private CompanyRealtimeNotificationService $notificationService)
    {
    }

    /**
     * Get binome status for an application
     */
    public function status(Request $request, int $applicationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $application = $this->findCandidateApplication($candidate, $applicationId)
            ?: $this->findCandidateBinomeApplication($candidate, $applicationId);
        if (!$application) {
            return response()->json([
                'success' => false,
                'message' => 'Application not found.',
            ], 404);
        }
        $isPrimaryApplicationOwner = (int) $application->candidate_id === (int) $candidate->id;

        $conversation = $this->resolveConversationForCandidateOnInternship($candidate, $application);
        $counterpart = null;
        if ($conversation && $conversation->isDuo()) {
            if ((int) $conversation->candidate_id === (int) $candidate->id) {
                $counterpart = $conversation->binome;
            } elseif ((int) $conversation->binome_candidate_id === (int) $candidate->id) {
                $counterpart = $conversation->candidate;
            } else {
                $counterpart = $conversation->binome;
            }
        }

        $invitation = BinomeInvitation::with(['inviter.user', 'invited.user', 'application.jobOffer'])
            ->whereHas('application', function ($q) use ($application) {
                $q->where('job_offer_id', $application->job_offer_id);
            })
            ->where(function ($q) use ($candidate) {
                $q->where('inviter_candidate_id', $candidate->id)
                    ->orWhere('invited_candidate_id', $candidate->id);
            })
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'has_binome' => $conversation && $conversation->isDuo(),
                'conversation_type' => $conversation?->conversation_type ?? 'solo',
                'binome_candidate' => $this->serializeCandidateSummary($counterpart),
                'invitation' => $invitation ? $this->serializeInvitation($invitation, $candidate) : null,
                'can_invite' => $isPrimaryApplicationOwner
                    ? $this->canInviteBinome($application, $candidate)
                    : false,
            ],
        ]);
    }

    /**
     * List accepted candidates for the same internship (same company, recruiter context when available).
     */
    public function acceptedCandidates(Request $request, int $applicationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $application = $this->findCandidateApplication($candidate, $applicationId);
        if (!$application) {
            return response()->json([
                'success' => false,
                'message' => 'Application not found.',
            ], 404);
        }

        $jobOffer = $application->jobOffer;
        if (!$jobOffer) {
            return response()->json([
                'success' => false,
                'message' => 'Internship offer not found.',
            ], 404);
        }

        $conversation = $application->internChatConversation;
        $recruiterId = $conversation?->recruiter_id ?: $this->resolveRecruiterIdForApplication($application);

        $baseQuery = Application::query()
            ->with(['candidate.user'])
            ->where('job_offer_id', $application->job_offer_id)
            ->where('status', 'accepted')
            ->where('candidate_id', '!=', $candidate->id)
            ->whereHas('candidate');

        if ($jobOffer->company_id) {
            $companyId = (int) $jobOffer->company_id;
            $baseQuery->whereHas('jobOffer', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            });
        }

        $allAcceptedForInternship = (clone $baseQuery)
            ->orderByDesc('applied_at')
            ->get();

        // Keep recruiter-context candidates first when available, but always include
        // every accepted candidate on the same internship offer.
        if ($recruiterId) {
            $resolvedRecruiterId = (int) $recruiterId;
            $scopedApplications = (clone $baseQuery)
                ->where(function ($q) use ($resolvedRecruiterId) {
                    $q->whereHas('internChatConversation', function ($conv) use ($resolvedRecruiterId) {
                        $conv->where('recruiter_id', $resolvedRecruiterId);
                    })->orWhereHas('interviews', function ($interview) use ($resolvedRecruiterId) {
                        $interview->where('recruiter_id', $resolvedRecruiterId);
                    });
                })
                ->orderByDesc('applied_at')
                ->get();

            $applications = $scopedApplications
                ->concat($allAcceptedForInternship)
                ->unique('id')
                ->values();
        } else {
            $applications = $allAcceptedForInternship;
        }

        $candidates = $applications
            ->pluck('candidate')
            ->filter()
            ->unique('id')
            ->values()
            ->map(fn (Candidate $item) => $this->serializeCandidateSummary($item))
            ->filter()
            ->values();

        return response()->json([
            'success' => true,
            'data' => $candidates,
        ]);
    }

    /**
     * Send a binome invitation by email
     */
    public function invite(Request $request, int $applicationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'message' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $application = $this->findCandidateApplication($candidate, $applicationId);
        if (!$application) {
            return response()->json([
                'success' => false,
                'message' => 'Application not found.',
            ], 404);
        }

        // Check if can invite
        if (!$this->canInviteBinome($application, $candidate)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot invite binome at this time. You may already have a binome or a pending invitation.',
            ], 422);
        }

        $invitedEmail = $request->input('email');
        
        // Check if trying to invite self
        if ($user->email === $invitedEmail) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot invite yourself as a binome.',
            ], 422);
        }

        // Find invited candidate by email
        $invitedUser = User::where('email', $invitedEmail)->first();
        if (!$invitedUser) {
            return response()->json([
                'success' => false,
                'message' => 'No candidate found with this email on our platform.',
            ], 404);
        }

        $invitedCandidate = Candidate::where('user_id', $invitedUser->id)->first();
        if (!$invitedCandidate) {
            return response()->json([
                'success' => false,
                'message' => 'This user is not a candidate.',
            ], 422);
        }

        // Check if invited candidate has an accepted application for the same internship
        $invitedApplication = Application::where('candidate_id', $invitedCandidate->id)
            ->where('job_offer_id', $application->job_offer_id)
            ->where('status', 'accepted')
            ->first();

        if (!$invitedApplication) {
            return response()->json([
                'success' => false,
                'message' => 'This candidate is not accepted for the same internship.',
            ], 422);
        }

        // Check for existing pending/accepted invitation
        $existing = BinomeInvitation::where('application_id', $applicationId)
            ->whereIn('status', ['pending', 'accepted'])
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'You already have an active binome invitation for this application.',
            ], 422);
        }

        // Check if invited candidate is already a binome elsewhere
        $existingAsBinome = InternChatConversation::where('binome_candidate_id', $invitedCandidate->id)
            ->whereHas('application', function ($q) use ($application) {
                $q->where('job_offer_id', $application->job_offer_id);
            })
            ->first();

        if ($existingAsBinome) {
            return response()->json([
                'success' => false,
                'message' => 'This candidate is already a binome for this internship.',
            ], 422);
        }

        try {
            $invitation = BinomeInvitation::create([
                'application_id' => $applicationId,
                'inviter_candidate_id' => $candidate->id,
                'invited_candidate_id' => $invitedCandidate->id,
                'invited_email' => $invitedEmail,
                'status' => 'pending',
                'message' => $request->input('message'),
            ]);

            $invitation->loadMissing(['inviter.user', 'invited.user', 'application.jobOffer']);

            try {
                $this->notificationService->notifyBinomeInvitation(
                    $invitation,
                    $candidate,
                    $invitedCandidate
                );
            } catch (\Throwable $notificationError) {
                Log::warning('Failed to notify invited candidate for binome invitation.', [
                    'invitation_id' => $invitation->id,
                    'error' => $notificationError->getMessage(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Binome invitation sent successfully.',
                'data' => [
                    'invitation' => $this->serializeInvitation($invitation, $candidate),
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create binome invitation', [
                'error' => $e->getMessage(),
                'application_id' => $applicationId,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send invitation. Please try again.',
            ], 500);
        }
    }

    /**
     * Accept a binome invitation
     */
    public function accept(Request $request, int $invitationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $invitation = BinomeInvitation::with([
            'application.jobOffer',
            'application.internChatConversation',
            'inviter.user',
            'invited.user',
        ])
            ->where('id', $invitationId)
            ->where('invited_candidate_id', $candidate->id)
            ->where('status', 'pending')
            ->first();

        if (!$invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Invitation not found or already responded.',
            ], 404);
        }

        try {
            DB::transaction(function () use ($invitation, $candidate) {
                // Update invitation status
                $invitation->markAsAccepted();

                // Update conversation to include binome
                $conversation = $invitation->application->internChatConversation;
                if ($conversation) {
                    $conversation->update([
                        'binome_candidate_id' => $candidate->id,
                    ]);
                } else {
                    // Create new conversation with binome
                    $application = $invitation->application;
                    $recruiterId = $application->internChatConversation?->recruiter_id;
                    
                    if (!$recruiterId) {
                        // Find recruiter for this application
                        $recruiterId = $this->resolveRecruiterIdForApplication($application);
                    }

                    InternChatConversation::create([
                        'application_id' => $application->id,
                        'company_id' => $application->jobOffer->company_id,
                        'recruiter_id' => $recruiterId,
                        'candidate_id' => $invitation->inviter_candidate_id,
                        'binome_candidate_id' => $candidate->id,
                    ]);
                }
            });

            $invitation->refresh();
            $invitation->loadMissing(['application.jobOffer', 'inviter.user', 'invited.user']);

            try {
                $inviterCandidate = $invitation->inviter;
                if ($inviterCandidate) {
                    $this->notificationService->notifyBinomeInvitationAccepted(
                        $invitation,
                        $inviterCandidate,
                        $candidate
                    );
                }
            } catch (\Throwable $notificationError) {
                Log::warning('Failed to notify inviter about accepted binome invitation.', [
                    'invitation_id' => $invitation->id,
                    'error' => $notificationError->getMessage(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'You are now binome partners! You can now chat together with the recruiter.',
                'data' => [
                    'invitation' => $this->serializeInvitation($invitation, $candidate),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to accept binome invitation', [
                'error' => $e->getMessage(),
                'invitation_id' => $invitationId,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to accept invitation. Please try again.',
            ], 500);
        }
    }

    /**
     * Reject a binome invitation
     */
    public function reject(Request $request, int $invitationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $invitation = BinomeInvitation::with(['application.jobOffer', 'inviter.user', 'invited.user'])
            ->where('id', $invitationId)
            ->where('invited_candidate_id', $candidate->id)
            ->where('status', 'pending')
            ->first();

        if (!$invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Invitation not found or already responded.',
            ], 404);
        }

        try {
            $invitation->markAsRejected();

            $invitation->refresh();
            $invitation->loadMissing(['application.jobOffer', 'inviter.user', 'invited.user']);

            try {
                $inviterCandidate = $invitation->inviter;
                if ($inviterCandidate) {
                    $this->notificationService->notifyBinomeInvitationRejected(
                        $invitation,
                        $inviterCandidate,
                        $candidate
                    );
                }
            } catch (\Throwable $notificationError) {
                Log::warning('Failed to notify inviter about rejected binome invitation.', [
                    'invitation_id' => $invitation->id,
                    'error' => $notificationError->getMessage(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Invitation rejected.',
                'data' => [
                    'invitation' => $this->serializeInvitation($invitation, $candidate),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to reject binome invitation', [
                'error' => $e->getMessage(),
                'invitation_id' => $invitationId,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to reject invitation. Please try again.',
            ], 500);
        }
    }

    /**
     * Cancel a sent invitation
     */
    public function cancel(Request $request, int $invitationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $invitation = BinomeInvitation::where('id', $invitationId)
            ->where('inviter_candidate_id', $candidate->id)
            ->where('status', 'pending')
            ->first();

        if (!$invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Invitation not found or already responded.',
            ], 404);
        }

        try {
            $invitation->markAsCancelled();

            return response()->json([
                'success' => true,
                'message' => 'Invitation cancelled.',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to cancel binome invitation', [
                'error' => $e->getMessage(),
                'invitation_id' => $invitationId,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to cancel invitation. Please try again.',
            ], 500);
        }
    }

    /**
     * List all binome invitations for the current candidate
     */
    public function listInvitations(Request $request)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $type = $request->input('type', 'all'); // 'sent', 'received', 'all'

        $query = BinomeInvitation::with([
            'application.jobOffer',
            'inviter.user',
            'invited.user',
        ]);

        if ($type === 'sent') {
            $query->where('inviter_candidate_id', $candidate->id);
        } elseif ($type === 'received') {
            $query->where('invited_candidate_id', $candidate->id);
        } else {
            $query->where(function ($q) use ($candidate) {
                $q->where('inviter_candidate_id', $candidate->id)
                  ->orWhere('invited_candidate_id', $candidate->id);
            });
        }

        $invitations = $query->latest()->get()->map(
            fn (BinomeInvitation $inv) => $this->serializeInvitation($inv, $candidate)
        );

        return response()->json([
            'success' => true,
            'data' => $invitations,
        ]);
    }

    /**
     * Remove a binome from conversation (only primary candidate can do this)
     */
    public function removeBinome(Request $request, int $applicationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $application = $this->findCandidateApplication($candidate, $applicationId);
        if (!$application) {
            return response()->json([
                'success' => false,
                'message' => 'Application not found.',
            ], 404);
        }

        $conversation = $application->internChatConversation;
        if (!$conversation || !$conversation->isDuo()) {
            return response()->json([
                'success' => false,
                'message' => 'No binome to remove.',
            ], 422);
        }

        // Only the primary candidate can remove binome
        if ($conversation->candidate_id !== $candidate->id) {
            return response()->json([
                'success' => false,
                'message' => 'Only the primary candidate can remove the binome.',
            ], 403);
        }

        try {
            DB::transaction(function () use ($conversation, $application) {
                // Update conversation
                $conversation->update([
                    'binome_candidate_id' => null,
                ]);

                // Update any active invitation
                BinomeInvitation::where('application_id', $application->id)
                    ->where('status', 'accepted')
                    ->update([
                        'status' => 'cancelled',
                        'responded_at' => now(),
                    ]);
            });

            return response()->json([
                'success' => true,
                'message' => 'Binome removed successfully.',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to remove binome', [
                'error' => $e->getMessage(),
                'application_id' => $applicationId,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to remove binome. Please try again.',
            ], 500);
        }
    }

    // ==================== Private Helper Methods ====================

    private function candidateContext(Request $request): array
    {
        $user = $request->user();
        $normalizedRole = strtolower((string) ($user?->role ?? ''));
        $isCandidateRole = in_array($normalizedRole, ['candidate', 'candidat'], true);
        if (!$user || !$isCandidateRole || !$user->candidate) {
            return [null, null, response()->json([
                'success' => false,
                'message' => 'Unauthorized: candidate account required.',
            ], 403)];
        }

        return [$user, $user->candidate, null];
    }

    private function findCandidateApplication(Candidate $candidate, int $applicationId): ?Application
    {
        return Application::query()
            ->with(['jobOffer', 'internChatConversation'])
            ->where('id', $applicationId)
            ->where('candidate_id', $candidate->id)
            ->where('status', 'accepted')
            ->whereHas('jobOffer', function ($q) {
                $q->where('offer_type', 'internship');
            })
            ->first();
    }

    private function findCandidateBinomeApplication(
        Candidate $candidate,
        int $applicationId
    ): ?Application {
        return Application::query()
            ->with(['jobOffer', 'internChatConversation'])
            ->where('id', $applicationId)
            ->where('status', 'accepted')
            ->whereHas('jobOffer', function ($q) {
                $q->where('offer_type', 'internship');
            })
            ->whereHas('internChatConversation', function ($q) use ($candidate) {
                $q->where('binome_candidate_id', $candidate->id);
            })
            ->first();
    }

    private function canInviteBinome(Application $application, Candidate $candidate): bool
    {
        // Must have an active conversation
        $conversation = $application->internChatConversation;
        
        // Check if already has binome
        if ($conversation && $conversation->isDuo()) {
            return false;
        }

        // Check for pending invitation from this candidate
        $hasPending = BinomeInvitation::where('application_id', $application->id)
            ->where('inviter_candidate_id', $candidate->id)
            ->where('status', 'pending')
            ->exists();

        if ($hasPending) {
            return false;
        }

        // Check if this candidate is already a binome elsewhere for same internship
        $isBinomeElsewhere = InternChatConversation::where('binome_candidate_id', $candidate->id)
            ->where('application_id', '!=', $application->id)
            ->whereHas('application', function ($q) use ($application) {
                $q->where('job_offer_id', $application->job_offer_id);
            })
            ->exists();

        if ($isBinomeElsewhere) {
            return false;
        }

        return true;
    }

    private function resolveConversationForCandidateOnInternship(
        Candidate $candidate,
        Application $application
    ): ?InternChatConversation {
        $baseQuery = InternChatConversation::query()
            ->with(['candidate.user', 'binome.user'])
            ->whereHas('application', function ($q) use ($application) {
                $q->where('job_offer_id', $application->job_offer_id);
            })
            ->where(function ($q) use ($candidate) {
                $q->where('candidate_id', $candidate->id)
                    ->orWhere('binome_candidate_id', $candidate->id);
            });

        $duoConversation = (clone $baseQuery)
            ->whereNotNull('binome_candidate_id')
            ->orderByDesc('id')
            ->first();

        if ($duoConversation) {
            return $duoConversation;
        }

        return (clone $baseQuery)
            ->orderByDesc('id')
            ->first();
    }

    private function serializeCandidateSummary(?Candidate $candidate): ?array
    {
        if (!$candidate) {
            return null;
        }

        return [
            'id' => $candidate->id,
            'first_name' => $candidate->first_name,
            'last_name' => $candidate->last_name,
            'email' => $candidate->user?->email,
            'picture' => $candidate->picture,
            'user_id' => $candidate->user?->id,
            'is_online' => $candidate->user?->is_online ?? false,
            'last_seen_at' => $candidate->user?->last_seen_at?->toIso8601String(),
        ];
    }

    private function serializeInvitation(BinomeInvitation $invitation, Candidate $currentCandidate): array
    {
        $isInviter = (int) $invitation->inviter_candidate_id === (int) $currentCandidate->id;
        $otherCandidate = $isInviter ? $invitation->invited : $invitation->inviter;

        return [
            'id' => $invitation->id,
            'status' => $invitation->status,
            'is_inviter' => $isInviter,
            'invited_email' => $invitation->invited_email,
            'invited_candidate' => $this->serializeCandidateSummary($invitation->invited),
            'other_candidate' => $this->serializeCandidateSummary($otherCandidate),
            'message' => $invitation->message,
            'job_offer' => [
                'id' => $invitation->application?->jobOffer?->id,
                'title' => $invitation->application?->jobOffer?->title,
            ],
            'created_at' => $invitation->created_at?->toIso8601String(),
            'responded_at' => $invitation->responded_at?->toIso8601String(),
        ];
    }

    private function resolveRecruiterIdForApplication(Application $application): ?int
    {
        $conversationRecruiterId = InternChatConversation::where('application_id', $application->id)
            ->value('recruiter_id');
        
        if ($conversationRecruiterId) {
            return $conversationRecruiterId;
        }

        // Find from interviews
        $interviewRecruiterId = $application->interviews()
            ->whereNotNull('recruiter_id')
            ->orderByDesc('scheduled_at')
            ->value('recruiter_id');

        if ($interviewRecruiterId) {
            return $interviewRecruiterId;
        }

        // Find from job offer recruiters
        $jobOfferRecruiter = $application->jobOffer?->recruiters()->first();
        if ($jobOfferRecruiter) {
            return $jobOfferRecruiter->id;
        }

        return null;
    }
}
