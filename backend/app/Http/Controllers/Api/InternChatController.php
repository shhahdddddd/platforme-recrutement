<?php

namespace App\Http\Controllers\Api;

use App\Events\InternChatMessageRead;
use App\Events\InternChatMessageSent;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Candidate;
use App\Models\InternChatConversation;
use App\Models\InternChatMessage;
use App\Models\Recruiter;
use App\Services\CompanyRealtimeNotificationService;
use App\Services\SubscriptionFeatureService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InternChatController extends Controller
{
    public function __construct(
        private CompanyRealtimeNotificationService $notificationService,
        private SubscriptionFeatureService $subscriptionFeatureService
    ) {
    }

    public function conversations(Request $request)
    {
        [$user, $recruiter, $errorResponse] = $this->recruiterContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if company has chat system enabled in their subscription
        $company = $recruiter->company;
        $hasSubscriptionAccess = $company && $this->subscriptionFeatureService->hasChatAccess($company);

        // Rule: chat is only for accepted internship applications handled by this responsible recruiter.
        $acceptedApplicationsQuery = Application::query()
            ->where('status', 'accepted')
            ->whereHas('jobOffer', function ($q) use ($recruiter) {
                $q->where('offer_type', 'internship')
                    ->where('company_id', $recruiter->company_id);
            });

        // If no subscription access, block access.
        if (!$hasSubscriptionAccess) {
            return response()->json([
                'success' => false,
                'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat'),
            ], 403);
        }

        $acceptedApplications = $acceptedApplicationsQuery
            ->with(['candidate.user', 'jobOffer.department'])
            ->latest('applied_at')
            ->get()
            ->filter(function (Application $app) use ($recruiter) {
                $responsible = $this->resolveRecruiterForApplication($app);
                return $responsible && (int) $responsible->id === (int) $recruiter->id;
            })
            ->values();

        $applicationIds = $acceptedApplications->pluck('id');

        $conversations = InternChatConversation::whereIn('application_id', $applicationIds)
            ->where('recruiter_id', $recruiter->id)
            ->with(['latestMessage', 'binome.user'])
            ->get()
            ->keyBy('application_id');

        $conversationIds = $conversations->pluck('id')->values();
        $unreadByConversation = collect();
        if ($conversationIds->isNotEmpty()) {
            $unreadByConversation = InternChatMessage::query()
                ->selectRaw('conversation_id, COUNT(*) as unread_count')
                ->whereIn('conversation_id', $conversationIds)
                ->whereNull('read_at')
                ->where(function ($q) use ($user) {
                    $q->where('receiver_user_id', $user->id);
                    if ($this->supportsGroupMessages()) {
                        $q->orWhere(function ($subQ) use ($user) {
                            $subQ->where('is_group_message', true)
                                ->where('sender_user_id', '!=', $user->id);
                        });
                    }
                })
                ->groupBy('conversation_id')
                ->pluck('unread_count', 'conversation_id');
        }

        $payload = $acceptedApplications->map(function (Application $app) use ($conversations, $unreadByConversation) {
            $conversation = $conversations->get($app->id);
            $latestMessage = $conversation?->latestMessage;

            $lastActivity = $conversation?->last_message_at
                ?? $latestMessage?->created_at
                ?? $app->applied_at;

            return [
                'application_id' => (int) $app->id,
                'conversation_id' => $conversation?->id,
                'conversation_type' => $conversation?->conversation_type ?? 'solo',
                'is_group' => $conversation?->isDuo() ?? false,
                'candidate' => [
                    'id' => $app->candidate?->id,
                    'first_name' => $app->candidate?->first_name,
                    'last_name' => $app->candidate?->last_name,
                    'email' => $app->candidate?->user?->email,
                    'picture' => $app->candidate?->picture,
                    'user_id' => $app->candidate?->user?->id,
                    'is_online' => $app->candidate?->user?->is_online ?? false,
                    'last_seen_at' => optional($app->candidate?->user?->last_seen_at)->toIso8601String(),
                ],
                'binome' => $conversation?->binome ? [
                    'id' => $conversation->binome->id,
                    'first_name' => $conversation->binome->first_name,
                    'last_name' => $conversation->binome->last_name,
                    'email' => $conversation->binome->user?->email,
                    'picture' => $conversation->binome->picture,
                    'user_id' => $conversation->binome->user?->id,
                    'is_online' => $conversation->binome->user?->is_online ?? false,
                    'last_seen_at' => optional($conversation->binome->user?->last_seen_at)->toIso8601String(),
                ] : null,
                'job_offer' => [
                    'id' => $app->jobOffer?->id,
                    'title' => $app->jobOffer?->title,
                    'department' => $app->jobOffer?->department?->name,
                ],
                'last_message' => $this->serializeMessagePreview($latestMessage),
                'unread_count' => (int) ($conversation ? ($unreadByConversation[$conversation->id] ?? 0) : 0),
                'last_activity_at' => optional($lastActivity)->toIso8601String(),
                'applied_at' => optional($app->applied_at)->toIso8601String(),
            ];
        })->sortByDesc(function (array $item) {
            return $item['last_activity_at'] ?? $item['applied_at'] ?? '';
        })->values();

        return response()->json([
            'success' => true,
            'data' => $payload,
        ]);
    }

    public function messages(Request $request, int $applicationId)
    {
        [$user, $recruiter, $errorResponse] = $this->recruiterContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if company has chat system enabled in their subscription
        $company = $recruiter->company;
        $hasSub = $company && $this->subscriptionFeatureService->hasChatAccess($company);
        $app = $this->findRecruiterChatApplication($recruiter, $applicationId);
        if (!$app) return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        if (!$hasSub) {
            return response()->json(['success' => false, 'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat')], 403);
        }
        $application = $app;

        $conversation = $this->conversationForApplication($application, $recruiter);
        $conversation->loadMissing('binome.user');

        $this->markConversationMessagesAsRead($conversation->id, (int) $user->id);

        $messages = InternChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->with('sender')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn (InternChatMessage $message) => $this->serializeMessage($message, $user->id));

        return response()->json([
            'success' => true,
            'data' => [
                'conversation' => [
                    'id' => (int) $conversation->id,
                    'application_id' => (int) $application->id,
                    'conversation_type' => $conversation->conversation_type,
                    'is_group' => $conversation->isDuo(),
                    'candidate' => [
                        'id' => $application->candidate?->id,
                        'first_name' => $application->candidate?->first_name,
                        'last_name' => $application->candidate?->last_name,
                        'email' => $application->candidate?->user?->email,
                        'picture' => $application->candidate?->picture,
                        'user_id' => $application->candidate?->user?->id,
                    ],
                    'binome' => $conversation->binome ? [
                        'id' => $conversation->binome->id,
                        'first_name' => $conversation->binome->first_name,
                        'last_name' => $conversation->binome->last_name,
                        'email' => $conversation->binome->user?->email,
                        'picture' => $conversation->binome->picture,
                        'user_id' => $conversation->binome->user?->id,
                    ] : null,
                    'job_offer' => [
                        'id' => $application->jobOffer?->id,
                        'title' => $application->jobOffer?->title,
                        'department' => $application->jobOffer?->department?->name,
                    ],
                ],
                'messages' => $messages,
            ],
        ]);
    }

    public function sendMessage(Request $request, int $applicationId)
    {
        [$user, $recruiter, $errorResponse] = $this->recruiterContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if company has chat system enabled in their subscription
        $company = $recruiter->company;
        $hasSubscriptionAccess = $company && $this->subscriptionFeatureService->hasChatAccess($company);

        $application = $this->findRecruiterChatApplication($recruiter, $applicationId);
        if (!$application) {
            return response()->json([
                'success' => false,
                'message' => 'Internship candidate not found in your recruiter scope.',
            ], 404);
        }

        // Allow if subscription is active
        if (!$hasSubscriptionAccess) {
            return response()->json([
                'success' => false,
                'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat'),
            ], 403);
        }

        $validated = $this->validateChatMessagePayload($request);

        $conversation = $this->conversationForApplication($application, $recruiter);
        
        // Determine message type and receivers
        $supportsGroupMessages = $this->supportsGroupMessages();
        $isGroupMessage = $conversation->isDuo() && $supportsGroupMessages;
        $receiverUserId = null;
        
        if (!$isGroupMessage) {
            // Solo conversation - send to primary candidate only
            $receiverUserId = $application->candidate?->user_id;
            if (!$receiverUserId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Candidate user account not found for chat.',
                ], 422);
            }
        }

        $messagePayload = [
            'conversation_id' => $conversation->id,
            'sender_user_id' => $user->id,
            'receiver_user_id' => $receiverUserId,
            'message' => $validated['message'],
            'read_at' => null,
            ...$this->storeChatAttachment($request->file('attachment'), $conversation, $user->id),
        ];

        if ($supportsGroupMessages) {
            $messagePayload['is_group_message'] = $isGroupMessage;
        }

        $message = InternChatMessage::create($messagePayload);

        $conversation->last_message_at = $message->created_at ?? now();
        $conversation->save();

        // Load sender relationship for broadcast
        $message->load('sender');

        // Broadcast real-time event
        try {
            $conversationData = [
                'id' => $conversation->id,
                'application_id' => $application->id,
                'conversation_type' => $conversation->conversation_type,
                'is_group' => $conversation->isDuo(),
                'candidate' => [
                    'id' => $application->candidate?->id,
                    'first_name' => $application->candidate?->first_name,
                    'last_name' => $application->candidate?->last_name,
                    'email' => $application->candidate?->user?->email,
                    'picture' => $application->candidate?->picture,
                    'user_id' => $application->candidate?->user?->id,
                    'is_online' => $application->candidate?->user?->is_online ?? false,
                    'last_seen_at' => optional($application->candidate?->user?->last_seen_at)->toIso8601String(),
                ],
                'binome' => $conversation->binome ? [
                    'id' => $conversation->binome->id,
                    'first_name' => $conversation->binome->first_name,
                    'last_name' => $conversation->binome->last_name,
                    'email' => $conversation->binome->user?->email,
                    'picture' => $conversation->binome->picture,
                    'user_id' => $conversation->binome->user?->id,
                    'is_online' => $conversation->binome->user?->is_online ?? false,
                    'last_seen_at' => optional($conversation->binome->user?->last_seen_at)->toIso8601String(),
                ] : null,
                'recruiter' => [
                    'id' => $recruiter->id,
                    'full_name' => $recruiter->full_name ?: $recruiter->user?->email,
                    'email' => $recruiter->user?->email,
                    'picture' => $recruiter->picture,
                    'user_id' => $recruiter->user?->id,
                    'is_online' => $recruiter->user?->is_online ?? false,
                    'last_seen_at' => optional($recruiter->user?->last_seen_at)->toIso8601String(),
                ],
                'job_offer' => [
                    'id' => $application->jobOffer?->id,
                    'title' => $application->jobOffer?->title,
                    'department' => $application->jobOffer?->department?->name,
                ],
                'last_message_at' => optional($conversation->last_message_at)->toIso8601String(),
            ];

            // Broadcast to all conversation members
            $participantUserIds = $conversation->getAllParticipantUserIds();
            foreach ($participantUserIds as $participantUserId) {
                if ($participantUserId !== $user->id) {
                    broadcast(new InternChatMessageSent(
                        $message,
                        $conversation->id,
                        $participantUserId,
                        $conversationData
                    ))->toOthers();
                }
            }
        } catch (\Throwable $e) {
            Log::warning('WebSocket broadcast failed (message saved).', [
                'error' => $e->getMessage(),
                'message_id' => $message->id,
            ]);
        }

        // Send push notification as backup
        try {
            if ($application->jobOffer && $application->candidate) {
                $preview = $this->buildMessagePreview($message);
                $this->notificationService->notifyInternChatMessage(
                    $application->jobOffer,
                    $application->candidate,
                    $recruiter,
                    (int) $application->id,
                    $preview
                );

                if ($conversation->isDuo() && $conversation->binome && (int) $conversation->binome->id !== (int) $application->candidate->id) {
                    $this->notificationService->notifyInternChatMessage(
                        $application->jobOffer,
                        $conversation->binome,
                        $recruiter,
                        (int) $application->id,
                        $preview
                    );
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to send chat notification.', [
                'application_id' => $application->id,
                'receiver_user_id' => $receiverUserId,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Message sent.',
            'data' => [
                'message' => $this->serializeMessage($message, $user->id),
            ],
        ], 201);
    }

    public function markAsRead(Request $request, int $applicationId)
    {
        [$user, $recruiter, $errorResponse] = $this->recruiterContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if company has chat system enabled in their subscription
        $company = $recruiter->company;
        $hasSub = $company && $this->subscriptionFeatureService->hasChatAccess($company);
        $app = $this->findRecruiterChatApplication($recruiter, $applicationId);
        if (!$app) return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        if (!$hasSub) {
            return response()->json(['success' => false, 'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat')], 403);
        }
        $application = $app;

        $conversation = $this->conversationForApplication($application, $recruiter);

        // Get unread message IDs before marking as read
        $unreadMessages = InternChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->whereNull('read_at')
            ->where(function ($q) use ($user) {
                $q->where('receiver_user_id', $user->id);
                if ($this->supportsGroupMessages()) {
                    $q->orWhere(function ($subQ) use ($user) {
                        $subQ->where('is_group_message', true)
                            ->where('sender_user_id', '!=', $user->id);
                    });
                }
            })
            ->get();

        $messageIds = $unreadMessages->pluck('id')->toArray();

        if (count($messageIds) > 0) {
            $readAt = now();

            // Mark messages as read
            InternChatMessage::query()
                ->where('conversation_id', $conversation->id)
                ->whereNull('read_at')
                ->where(function ($q) use ($user) {
                    $q->where('receiver_user_id', $user->id);
                    if ($this->supportsGroupMessages()) {
                        $q->orWhere(function ($subQ) use ($user) {
                            $subQ->where('is_group_message', true)
                                ->where('sender_user_id', '!=', $user->id);
                        });
                    }
                })
                ->update(['read_at' => $readAt]);

            // Broadcast read receipt
            try {
                broadcast(new InternChatMessageRead(
                    $conversation->id,
                    $user->id,
                    $messageIds,
                    optional($readAt)->toIso8601String()
                ))->toOthers();
            } catch (\Throwable $e) {
                Log::warning('WebSocket read receipt broadcast failed.', [
                    'error' => $e->getMessage(),
                    'conversation_id' => $conversation->id,
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'marked_count' => count($messageIds),
                'read_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function candidateMarkAsRead(Request $request, int $applicationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if company has chat system enabled in their subscription
        if ($candidate->company) {
            $company = $candidate->company;
            if (!$hasSub) {
                return response()->json(['success' => false, 'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat')], 403);
            }
        }

        $conversation = $this->resolveOrCreateCandidateChatConversation($candidate, $applicationId);
        if (!$conversation) {
            return response()->json([
                'success' => false,
                'message' => 'Internship conversation not found for this candidate.',
            ], 404);
        }

        // Get unread message IDs before marking as read
        $unreadMessages = InternChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->whereNull('read_at')
            ->where(function ($q) use ($user) {
                $q->where('receiver_user_id', $user->id)
                    ->orWhere(function ($subQ) use ($user) {
                        $subQ->where('is_group_message', true)
                            ->where('sender_user_id', '!=', $user->id);
                    });
            })
            ->get();

        $messageIds = $unreadMessages->pluck('id')->toArray();

        if (count($messageIds) > 0) {
            $readAt = now();

            // Mark messages as read
            InternChatMessage::query()
                ->where('conversation_id', $conversation->id)
                ->whereNull('read_at')
                ->where(function ($q) use ($user) {
                    $q->where('receiver_user_id', $user->id)
                        ->orWhere(function ($subQ) use ($user) {
                            $subQ->where('is_group_message', true)
                                ->where('sender_user_id', '!=', $user->id);
                        });
                })
                ->update(['read_at' => $readAt]);

            // Broadcast read receipt
            try {
                broadcast(new InternChatMessageRead(
                    $conversation->id,
                    $user->id,
                    $messageIds,
                    optional($readAt)->toIso8601String()
                ))->toOthers();
            } catch (\Throwable $e) {
                Log::warning('WebSocket read receipt broadcast failed.', [
                    'error' => $e->getMessage(),
                    'conversation_id' => $conversation->id,
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'marked_count' => count($messageIds),
                'read_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function unreadCount(Request $request)
    {
        [$user, $recruiter, $errorResponse] = $this->recruiterContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        $company = $recruiter->company;
        $hasSub = $company && $this->subscriptionFeatureService->hasChatAccess($company);
        
        if (!$hasSub) {
            return response()->json(['success' => false, 'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat')], 403);
        }

        $count = InternChatMessage::query()
            ->whereNull('read_at')
            ->where(function ($q) use ($user) {
                $q->where('receiver_user_id', $user->id);
                if ($this->supportsGroupMessages()) {
                    $q->orWhere(function ($subQ) use ($user) {
                        $subQ->where('is_group_message', true)
                            ->where('sender_user_id', '!=', $user->id);
                    });
                }
            })
            ->whereHas('conversation', function ($q) use ($recruiter) {
                $q->where('recruiter_id', $recruiter->id);
            })
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'unread_count' => (int) $count,
            ],
        ]);
    }

    public function candidateConversations(Request $request)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if candidate's company (if assigned) has chat enabled. 
        // Note: For candidates applying to external companies, the check happens per message/conversation below.
        // But we can check if they have any access at all here if needed.

        // Rule: candidate chat is only for accepted internship applications.
        $acceptedApplications = $this->scopedAcceptedInternshipApplicationsForCandidate($candidate)
            ->with([
                'jobOffer.department',
                'internChatConversation.latestMessage',
                'internChatConversation.recruiter.user',
                'internChatConversation.binome.user',
                'internChatConversation.candidate.user',
                'interviews.recruiter.user',
                'jobOffer.recruiters.user',
            ])
            ->latest('applied_at')
            ->get();

        $binomeConversations = InternChatConversation::query()
            ->where('binome_candidate_id', $candidate->id)
            ->whereHas('application', function ($q) {
                $q->where('status', 'accepted')
                    ->whereHas('jobOffer', function ($jobQ) {
                        $jobQ->where('offer_type', 'internship');
                    });
            })
            ->with([
                'latestMessage',
                'recruiter.user',
                'candidate.user',
                'binome.user',
                'application.jobOffer.department',
                'application.interviews.recruiter.user',
                'application.jobOffer.recruiters.user',
            ])
            ->get()
            ->keyBy('application_id');

        $jobOfferIdsAsBinome = $binomeConversations
            ->map(fn (InternChatConversation $conversation) => (int) ($conversation->application?->job_offer_id ?? 0))
            ->filter(fn (int $jobOfferId) => $jobOfferId > 0)
            ->unique()
            ->values();

        $applications = $acceptedApplications
            ->filter(function (Application $app) use ($jobOfferIdsAsBinome) {
                return !$jobOfferIdsAsBinome->contains((int) $app->job_offer_id);
            })
            ->values();
        $ownedApplicationIds = $applications
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $applicationConversationIds = $applications
            ->pluck('internChatConversation')
            ->filter()
            ->pluck('id')
            ->values();
        $binomeConversationIds = $binomeConversations->pluck('id')->values();
        $conversationIds = $applicationConversationIds
            ->merge($binomeConversationIds)
            ->unique()
            ->values();

        $unreadByConversation = collect();
        if ($conversationIds->isNotEmpty()) {
            $unreadByConversation = InternChatMessage::query()
                ->selectRaw('conversation_id, COUNT(*) as unread_count')
                ->whereIn('conversation_id', $conversationIds)
                ->whereNull('read_at')
                ->where(function ($q) use ($user) {
                    $q->where('receiver_user_id', $user->id)
                        ->orWhere(function ($subQ) use ($user) {
                            $subQ->where('is_group_message', true)
                                ->where('sender_user_id', '!=', $user->id);
                        });
                })
                ->groupBy('conversation_id')
                ->pluck('unread_count', 'conversation_id');
        }

        $applicationPayload = $applications->map(function (Application $app) use ($candidate, $unreadByConversation) {
            $conversation = $app->internChatConversation;
            $recruiter = $conversation?->recruiter ?: $this->resolveRecruiterForApplication($app);
            if (!$recruiter) {
                return null;
            }

            $latestMessage = $conversation?->latestMessage;
            $lastActivity = $conversation?->last_message_at
                ?? $latestMessage?->created_at
                ?? $app->applied_at;

            return [
                'application_id' => (int) $app->id,
                'conversation_id' => $conversation?->id,
                'conversation_type' => $conversation?->conversation_type ?? 'solo',
                'is_group' => $conversation?->isDuo() ?? false,
                'is_binome_member' => $conversation ? ((int) $conversation->binome_candidate_id === (int) $candidate->id) : false,
                'recruiter' => [
                    'id' => (int) $recruiter->id,
                    'full_name' => $recruiter->full_name ?: $recruiter->user?->email,
                    'email' => $recruiter->user?->email,
                    'picture' => $recruiter->picture,
                    'user_id' => $recruiter->user?->id,
                    'is_online' => $recruiter->user?->is_online ?? false,
                    'last_seen_at' => optional($recruiter->user?->last_seen_at)->toIso8601String(),
                ],
                'binome' => $conversation?->binome ? [
                    'id' => $conversation->binome->id,
                    'first_name' => $conversation->binome->first_name,
                    'last_name' => $conversation->binome->last_name,
                    'email' => $conversation->binome->user?->email,
                    'picture' => $conversation->binome->picture,
                    'user_id' => $conversation->binome->user?->id,
                    'is_online' => $conversation->binome->user?->is_online ?? false,
                    'last_seen_at' => optional($conversation->binome->user?->last_seen_at)->toIso8601String(),
                ] : null,
                'job_offer' => [
                    'id' => $app->jobOffer?->id,
                    'title' => $app->jobOffer?->title,
                    'department' => $app->jobOffer?->department?->name,
                ],
                'last_message' => $this->serializeMessagePreview($latestMessage),
                'unread_count' => (int) ($conversation ? ($unreadByConversation[$conversation->id] ?? 0) : 0),
                'last_activity_at' => optional($lastActivity)->toIso8601String(),
                'applied_at' => optional($app->applied_at)->toIso8601String(),
            ];
        })->filter()->values();

        $binomePayload = $binomeConversations
            ->filter(function (InternChatConversation $conversation) use ($ownedApplicationIds) {
                return !in_array((int) $conversation->application_id, $ownedApplicationIds, true);
            })
            ->map(function (InternChatConversation $conversation) use ($unreadByConversation) {
                $application = $conversation->application;
                if (!$application) {
                    return null;
                }

                $recruiter = $conversation->recruiter ?: $this->resolveRecruiterForApplication($application);
                if (!$recruiter) {
                    return null;
                }

                $latestMessage = $conversation->latestMessage;
                $lastActivity = $conversation->last_message_at
                    ?? $latestMessage?->created_at
                    ?? $application->applied_at;

                return [
                    'application_id' => (int) $application->id,
                    'conversation_id' => (int) $conversation->id,
                    'conversation_type' => $conversation->conversation_type ?? 'duo',
                    'is_group' => $conversation->isDuo(),
                    'is_binome_member' => true,
                    'recruiter' => [
                        'id' => (int) $recruiter->id,
                        'full_name' => $recruiter->full_name ?: $recruiter->user?->email,
                        'email' => $recruiter->user?->email,
                        'picture' => $recruiter->picture,
                        'user_id' => $recruiter->user?->id,
                        'is_online' => $recruiter->user?->is_online ?? false,
                        'last_seen_at' => optional($recruiter->user?->last_seen_at)->toIso8601String(),
                    ],
                    'binome' => $conversation->binome ? [
                        'id' => $conversation->binome->id,
                        'first_name' => $conversation->binome->first_name,
                        'last_name' => $conversation->binome->last_name,
                        'email' => $conversation->binome->user?->email,
                        'picture' => $conversation->binome->picture,
                        'user_id' => $conversation->binome->user?->id,
                        'is_online' => $conversation->binome->user?->is_online ?? false,
                        'last_seen_at' => optional($conversation->binome->user?->last_seen_at)->toIso8601String(),
                    ] : null,
                    'job_offer' => [
                        'id' => $application->jobOffer?->id,
                        'title' => $application->jobOffer?->title,
                        'department' => $application->jobOffer?->department?->name,
                    ],
                    'last_message' => $this->serializeMessagePreview($latestMessage),
                    'unread_count' => (int) ($unreadByConversation[$conversation->id] ?? 0),
                    'last_activity_at' => optional($lastActivity)->toIso8601String(),
                    'applied_at' => optional($application->applied_at)->toIso8601String(),
                ];
            })
            ->filter()
            ->values();

        $payload = $applicationPayload
            ->concat($binomePayload)
            ->sortByDesc(function (array $item) {
            return $item['last_activity_at'] ?? $item['applied_at'] ?? '';
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $payload,
        ]);
    }

    public function candidateMessages(Request $request, int $applicationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if company has chat system enabled in their subscription
        $application = Application::find($applicationId);
        if ($application && $application->jobOffer && $application->jobOffer->company) {
            $company = $application->jobOffer->company;
            $hasSub = $this->subscriptionFeatureService->hasChatAccess($company);
            if (!$hasSub) {
                return response()->json(['success' => false, 'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat')], 403);
            }
        }

        $conversation = $this->resolveOrCreateCandidateChatConversation($candidate, $applicationId);
        if (!$conversation) {
            return response()->json([
                'success' => false,
                'message' => 'Internship conversation not found for this candidate.',
            ], 404);
        }

        $conversation->loadMissing([
            'application.candidate.user',
            'application.jobOffer.department',
            'recruiter.user',
            'candidate.user',
            'binome.user',
        ]);
        $application = $conversation->application;
        if (!$application) {
            return response()->json([
                'success' => false,
                'message' => 'Internship application not found.',
            ], 404);
        }

        $this->markConversationMessagesAsRead($conversation->id, (int) $user->id);

        $messages = InternChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->with('sender')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn (InternChatMessage $message) => $this->serializeMessage($message, $user->id));

        $recruiter = $conversation->recruiter ?: $this->resolveRecruiterForApplication($application);

        return response()->json([
            'success' => true,
            'data' => [
                'conversation' => [
                    'id' => (int) $conversation->id,
                    'application_id' => (int) $application->id,
                    'conversation_type' => $conversation->conversation_type,
                    'is_group' => $conversation->isDuo(),
                    'is_binome_member' => (int) $conversation->binome_candidate_id === (int) $candidate->id,
                    'candidate' => [
                        'id' => $conversation->candidate?->id,
                        'first_name' => $conversation->candidate?->first_name,
                        'last_name' => $conversation->candidate?->last_name,
                        'email' => $conversation->candidate?->user?->email,
                        'picture' => $conversation->candidate?->picture,
                        'user_id' => $conversation->candidate?->user?->id,
                    ],
                    'binome' => $conversation->binome ? [
                        'id' => $conversation->binome->id,
                        'first_name' => $conversation->binome->first_name,
                        'last_name' => $conversation->binome->last_name,
                        'email' => $conversation->binome->user?->email,
                        'picture' => $conversation->binome->picture,
                        'user_id' => $conversation->binome->user?->id,
                    ] : null,
                    'recruiter' => [
                        'id' => $recruiter?->id,
                        'full_name' => $recruiter?->full_name ?: $recruiter?->user?->email,
                        'email' => $recruiter?->user?->email,
                        'picture' => $recruiter?->picture,
                        'user_id' => $recruiter?->user?->id,
                    ],
                    'job_offer' => [
                        'id' => $application->jobOffer?->id,
                        'title' => $application->jobOffer?->title,
                        'department' => $application->jobOffer?->department?->name,
                    ],
                ],
                'messages' => $messages,
            ],
        ]);
    }

    public function candidateSendMessage(Request $request, int $applicationId)
    {
        [$user, $candidate, $errorResponse] = $this->candidateContext($request);
        if ($errorResponse) {
            return $errorResponse;
        }

        // Check if company has chat system enabled in their subscription
        $application = Application::find($applicationId);
        if ($application && $application->jobOffer && $application->jobOffer->company) {
            $company = $application->jobOffer->company;
            $hasSub = $this->subscriptionFeatureService->hasChatAccess($company);
            if (!$hasSub) {
                return response()->json(['success' => false, 'message' => $this->subscriptionFeatureService->getFeatureNotEnabledMessage('chat')], 403);
            }
        }

        $validated = $this->validateChatMessagePayload($request);

        $conversation = $this->resolveOrCreateCandidateChatConversation($candidate, $applicationId);
        if (!$conversation) {
            return response()->json([
                'success' => false,
                'message' => 'Internship conversation not found for this candidate.',
            ], 404);
        }

        $conversation->loadMissing([
            'application.candidate.user',
            'application.jobOffer.department',
            'recruiter.user',
            'candidate.user',
            'binome.user',
        ]);
        $application = $conversation->application;
        if (!$application) {
            return response()->json([
                'success' => false,
                'message' => 'Internship application not found.',
            ], 404);
        }

        $recruiter = $conversation->recruiter ?: $this->resolveRecruiterForApplication($application);
        if (!$recruiter) {
            return response()->json([
                'success' => false,
                'message' => 'No recruiter has been assigned yet for this internship chat.',
            ], 422);
        }

        if ((int) ($conversation->recruiter_id ?? 0) !== (int) $recruiter->id) {
            $conversation->recruiter_id = $recruiter->id;
            $conversation->save();
        }

        $conversation->setRelation('recruiter', $recruiter);
        
        // Determine message type and receivers
        $supportsGroupMessages = $this->supportsGroupMessages();
        $isGroupMessage = $conversation->isDuo() && $supportsGroupMessages;
        $receiverUserId = null;
        
        if (!$isGroupMessage) {
            // Solo conversation - send to recruiter only
            $receiverUserId = $recruiter->user_id;
            if (!$receiverUserId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Recruiter user account not found for chat.',
                ], 422);
            }
        }

        $messagePayload = [
            'conversation_id' => $conversation->id,
            'sender_user_id' => $user->id,
            'receiver_user_id' => $receiverUserId,
            'message' => $validated['message'],
            'read_at' => null,
            ...$this->storeChatAttachment($request->file('attachment'), $conversation, $user->id),
        ];

        if ($supportsGroupMessages) {
            $messagePayload['is_group_message'] = $isGroupMessage;
        }

        $message = InternChatMessage::create($messagePayload);

        $conversation->last_message_at = $message->created_at ?? now();
        $conversation->save();

        // Load sender relationship for broadcast
        $message->load('sender');

        // Broadcast real-time event
        try {
            $conversationData = [
                'id' => $conversation->id,
                'application_id' => $application->id,
                'conversation_type' => $conversation->conversation_type,
                'is_group' => $conversation->isDuo(),
                'candidate' => [
                    'id' => $application->candidate?->id,
                    'first_name' => $application->candidate?->first_name,
                    'last_name' => $application->candidate?->last_name,
                    'email' => $application->candidate?->user?->email,
                    'picture' => $application->candidate?->picture,
                    'user_id' => $application->candidate?->user?->id,
                ],
                'binome' => $conversation->binome ? [
                    'id' => $conversation->binome->id,
                    'first_name' => $conversation->binome->first_name,
                    'last_name' => $conversation->binome->last_name,
                    'email' => $conversation->binome->user?->email,
                    'picture' => $conversation->binome->picture,
                    'user_id' => $conversation->binome->user?->id,
                ] : null,
                'recruiter' => [
                    'id' => $recruiter->id,
                    'full_name' => $recruiter->full_name ?? $recruiter->user?->email,
                    'email' => $recruiter->user?->email,
                    'picture' => $recruiter->picture,
                    'user_id' => $recruiter->user?->id,
                ],
                'job_offer' => [
                    'id' => $application->jobOffer?->id,
                    'title' => $application->jobOffer?->title,
                    'department' => $application->jobOffer?->department?->name,
                ],
                'last_message_at' => optional($conversation->last_message_at)->toIso8601String(),
            ];

            // Broadcast to all conversation members
            $participantUserIds = $conversation->getAllParticipantUserIds();
            foreach ($participantUserIds as $participantUserId) {
                if ($participantUserId !== $user->id) {
                    broadcast(new InternChatMessageSent(
                        $message,
                        $conversation->id,
                        $participantUserId,
                        $conversationData
                    ))->toOthers();
                }
            }
        } catch (\Throwable $e) {
            Log::warning('WebSocket broadcast failed (message saved).', [
                'error' => $e->getMessage(),
                'message_id' => $message->id,
            ]);
        }

        // Send push notification as backup
        try {
            if ($application->jobOffer) {
                $this->notificationService->notifyRecruiterInternChatMessage(
                    $application->jobOffer,
                    $recruiter,
                    $candidate,
                    (int) $application->id,
                    $this->buildMessagePreview($message)
                );
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to notify recruiter for chat message.', [
                'application_id' => $application->id,
                'receiver_user_id' => $receiverUserId,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Message sent.',
            'data' => [
                'message' => $this->serializeMessage($message, $user->id),
            ],
        ], 201);
    }

    private function validateChatMessagePayload(Request $request): array
    {
        $validated = $request->validate([
            'message' => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx|max:10240',
        ]);

        $messageText = trim((string) ($validated['message'] ?? ''));
        if ($messageText === '') {
            $messageText = null;
        }

        if ($messageText === null && !$request->hasFile('attachment')) {
            throw ValidationException::withMessages([
                'message' => ['A message or attachment is required.'],
            ]);
        }

        $validated['message'] = $messageText;

        return $validated;
    }

    private function storeChatAttachment(?UploadedFile $file, InternChatConversation $conversation, int $senderUserId): array
    {
        if (!$file) {
            return [];
        }

        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $fileName = sprintf(
            'chat_%d_%d_%s.%s',
            $conversation->id,
            $senderUserId,
            Str::lower(Str::random(16)),
            $extension
        );

        $filePath = $file->storeAs('chat_attachments', $fileName, 'public');

        return [
            'attachment_original_name' => $file->getClientOriginalName(),
            'attachment_path' => $filePath,
            'attachment_mime_type' => $file->getMimeType(),
            'attachment_size' => $file->getSize(),
        ];
    }

    private function markConversationMessagesAsRead(int $conversationId, int $userId): void
    {
        $query = InternChatMessage::query()
            ->where('conversation_id', $conversationId)
            ->whereNull('read_at');

        if ($this->supportsGroupMessages()) {
            $query->where(function ($q) use ($userId) {
                $q->where('receiver_user_id', $userId)
                    ->orWhere(function ($subQ) {
                        $subQ->where('is_group_message', true)
                            ->whereNull('read_at');
                    });
            });
        } else {
            $query->where('receiver_user_id', $userId);
        }

        $query->update(['read_at' => now()]);
    }

    private function supportsGroupMessages(): bool
    {
        static $supportsGroupMessages = null;

        if ($supportsGroupMessages === null) {
            $supportsGroupMessages = Schema::hasColumn('intern_chat_messages', 'is_group_message');
        }

        return (bool) $supportsGroupMessages;
    }

    private function serializeMessage(InternChatMessage $message, int $currentUserId): array
    {
        return [
            'id' => (int) $message->id,
            'message' => $message->message,
            'created_at' => optional($message->created_at)->toIso8601String(),
            'read_at' => optional($message->read_at)->toIso8601String(),
            'sender_user_id' => (int) $message->sender_user_id,
            'receiver_user_id' => $message->receiver_user_id !== null ? (int) $message->receiver_user_id : null,
            'is_mine' => (int) $message->sender_user_id === (int) $currentUserId,
            'attachment' => $this->serializeAttachment($message),
            'sender' => [
                'id' => $message->sender?->id !== null ? (int) $message->sender?->id : null,
                'email' => $message->sender?->email,
                'role' => $message->sender?->role,
            ],
        ];
    }

    private function serializeMessagePreview(?InternChatMessage $message): ?array
    {
        if (!$message) {
            return null;
        }

        return [
            'id' => (int) $message->id,
            'message' => $message->message,
            'sender_user_id' => (int) $message->sender_user_id,
            'created_at' => optional($message->created_at)->toIso8601String(),
            'preview' => $this->buildMessagePreview($message),
            'attachment' => $this->serializeAttachment($message),
        ];
    }

    private function serializeAttachment(InternChatMessage $message): ?array
    {
        if (!$message->hasAttachment()) {
            return null;
        }

        return [
            'original_name' => $message->attachment_original_name,
            'file_size' => (int) $message->attachment_size,
            'mime_type' => $message->attachment_mime_type,
            'download_url' => $message->attachment_download_url,
            'extension' => $message->attachment_extension,
        ];
    }

    private function buildMessagePreview(InternChatMessage $message): string
    {
        $text = trim((string) ($message->message ?? ''));
        if ($text !== '') {
            return $text;
        }

        if ($message->attachment_original_name) {
            return 'Attachment: ' . $message->attachment_original_name;
        }

        return '';
    }

    private function recruiterContext(Request $request): array
    {
        $user = $request->user();
        if (!$user || !$user->isRecruiter() || !$user->recruiter) {
            return [null, null, response()->json([
                'success' => false,
                'message' => 'Unauthorized: recruiter account required.',
            ], 403)];
        }

        return [$user, $user->recruiter, null];
    }

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

    private function findScopedAcceptedInternshipApplication(Recruiter $recruiter, int $applicationId): ?Application
    {
        return $this->scopedAcceptedInternshipApplications($recruiter)
            ->with(['candidate.user', 'jobOffer.department'])
            ->where('applications.id', $applicationId)
            ->first();
    }

    private function findCandidateAcceptedInternshipApplication(Candidate $candidate, int $applicationId): ?Application
    {
        return $this->scopedAcceptedInternshipApplicationsForCandidate($candidate)
            ->with([
                'candidate.user',
                'jobOffer.department',
                'jobOffer.recruiters.user',
                'interviews.recruiter.user',
                'internChatConversation.recruiter.user',
            ])
            ->where('applications.id', $applicationId)
            ->first();
    }

    private function findRecruiterChatApplication(Recruiter $recruiter, int $applicationId): ?Application
    {
        $application = Application::query()
            ->with(['candidate.user', 'jobOffer.department'])
            ->where('applications.id', $applicationId)
            ->where('status', 'accepted')
            ->whereHas('jobOffer', function ($q) use ($recruiter) {
                $q->where('offer_type', 'internship')
                    ->where('company_id', $recruiter->company_id);
            })
            ->first();

        if (!$application) {
            return null;
        }

        $responsible = $this->resolveRecruiterForApplication($application);
        if (!$responsible || (int) $responsible->id !== (int) $recruiter->id) {
            return null;
        }

        return $application;
    }

    private function findCandidateChatConversation(Candidate $candidate, int $applicationId): ?InternChatConversation
    {
        return InternChatConversation::query()
            ->with([
                'application.candidate.user',
                'application.jobOffer.department',
                'application.jobOffer.recruiters.user',
                'application.interviews.recruiter.user',
                'recruiter.user',
                'candidate.user',
                'binome.user',
            ])
            ->where('application_id', $applicationId)
            ->where(function ($q) use ($candidate) {
                $q->where('candidate_id', $candidate->id)
                    ->orWhere('binome_candidate_id', $candidate->id);
            })
            ->whereHas('application', function ($q) {
                $q->where('status', 'accepted')
                    ->whereHas('jobOffer', function ($jobQ) {
                        $jobQ->where('offer_type', 'internship');
                    });
            })
            ->first();
    }

    private function resolveOrCreateCandidateChatConversation(
        Candidate $candidate,
        int $applicationId
    ): ?InternChatConversation {
        $conversation = $this->findCandidateChatConversation($candidate, $applicationId);
        if ($conversation) {
            return $conversation;
        }

        $application = $this->findCandidateAcceptedInternshipApplication($candidate, $applicationId);
        if (!$application) {
            return null;
        }

        return $this->conversationForCandidateOwnedApplication($application);
    }

    private function scopedAcceptedInternshipApplications(Recruiter $recruiter)
    {
        $jobIds = $this->resolveScopedJobIdsForRecruiter($recruiter);
        $hasInterviewRecruiterColumn = $this->hasInterviewRecruiterColumn();

        return Application::query()
            ->where(function ($q) use ($jobIds, $recruiter, $hasInterviewRecruiterColumn) {
                $q->whereIn('job_offer_id', $jobIds)
                    ->when($hasInterviewRecruiterColumn, function ($subQ) use ($recruiter) {
                        $subQ->orWhereHas('interviews', function ($iq) use ($recruiter) {
                            $iq->where('recruiter_id', $recruiter->id);
                        });
                    });
            })
            ->where('status', 'accepted')
            ->whereHas('jobOffer', function ($q) use ($recruiter) {
                $q->where('offer_type', 'internship')
                    ->where('company_id', $recruiter->company_id);
            });
    }

    private function scopedAcceptedInternshipApplicationsForCandidate(Candidate $candidate)
    {
        return Application::query()
            ->where('candidate_id', $candidate->id)
            ->where('status', 'accepted')
            ->whereHas('jobOffer', function ($q) {
                $q->where('offer_type', 'internship');
            });
    }

    private function conversationForApplication(Application $application, Recruiter $recruiter): InternChatConversation
    {
        return InternChatConversation::firstOrCreate(
            ['application_id' => $application->id],
            [
                'company_id' => $recruiter->company_id,
                'recruiter_id' => $recruiter->id,
                'candidate_id' => (int) $application->candidate_id,
            ]
        );
    }

    private function conversationForCandidateOwnedApplication(Application $application): ?InternChatConversation
    {
        $existing = InternChatConversation::query()
            ->where('application_id', $application->id)
            ->with([
                'application.candidate.user',
                'application.jobOffer.department',
                'application.jobOffer.recruiters.user',
                'application.interviews.recruiter.user',
                'recruiter.user',
                'candidate.user',
                'binome.user',
            ])
            ->first();

        if ($existing) {
            return $existing;
        }

        $recruiter = $this->resolveRecruiterForApplication($application);
        if (!$recruiter) {
            return null;
        }

        $conversation = InternChatConversation::firstOrCreate(
            ['application_id' => $application->id],
            [
                'company_id' => $recruiter->company_id,
                'recruiter_id' => $recruiter->id,
                'candidate_id' => (int) $application->candidate_id,
            ]
        );

        $conversation->load([
            'application.candidate.user',
            'application.jobOffer.department',
            'application.jobOffer.recruiters.user',
            'application.interviews.recruiter.user',
            'recruiter.user',
            'candidate.user',
            'binome.user',
        ]);

        return $conversation;
    }

    private function resolveRecruiterForApplication(Application $application): ?Recruiter
    {
        $loadedConversationRecruiter = $application->internChatConversation?->recruiter;
        if ($loadedConversationRecruiter) {
            return $loadedConversationRecruiter;
        }

        $conversationRecruiterId = InternChatConversation::query()
            ->where('application_id', $application->id)
            ->value('recruiter_id');
        if ($conversationRecruiterId) {
            $conversationRecruiter = Recruiter::query()->with('user')->find($conversationRecruiterId);
            if ($conversationRecruiter) {
                return $conversationRecruiter;
            }
        }

        if ($this->hasInterviewRecruiterColumn()) {
            $interviewRecruiterId = $application->interviews()
                ->whereNotNull('recruiter_id')
                ->orderByDesc('scheduled_at')
                ->orderByDesc('id')
                ->value('recruiter_id');
            if ($interviewRecruiterId) {
                $interviewRecruiter = Recruiter::query()->with('user')->find($interviewRecruiterId);
                if ($interviewRecruiter) {
                    return $interviewRecruiter;
                }
            }
        }

        $jobOffer = $application->jobOffer;
        if (!$jobOffer) {
            return null;
        }

        if ($this->hasRecruiterAssignmentsTable()) {
            $assignedRecruiterId = DB::table('job_offer_recruiter_assignments as assignments')
                ->join('recruiters as recruiters', 'recruiters.id', '=', 'assignments.recruiter_id')
                ->where('assignments.job_offer_id', $application->job_offer_id)
                ->when($jobOffer->company_id, function ($q) use ($jobOffer) {
                    $q->where('recruiters.company_id', $jobOffer->company_id);
                })
                ->orderBy('assignments.recruiter_id')
                ->value('assignments.recruiter_id');

            if ($assignedRecruiterId) {
                $assignedRecruiter = Recruiter::query()->with('user')->find($assignedRecruiterId);
                if ($assignedRecruiter) {
                    return $assignedRecruiter;
                }
            }
        }

        $jobOfferRecruiter = $jobOffer->recruiters()->with('user')->orderBy('recruiters.id')->first();
        if ($jobOfferRecruiter) {
            return $jobOfferRecruiter;
        }

        $sameDeptRecruiter = Recruiter::query()
            ->with('user')
            ->where('company_id', $jobOffer->company_id)
            ->when($jobOffer->department_id, function ($q) use ($jobOffer) {
                $q->where('department_id', $jobOffer->department_id);
            })
            ->orderBy('id')
            ->first();

        if ($sameDeptRecruiter) {
            return $sameDeptRecruiter;
        }

        return Recruiter::query()
            ->with('user')
            ->where('company_id', $jobOffer->company_id)
            ->orderBy('id')
            ->first();
    }

    private function resolveScopedJobIdsForRecruiter(Recruiter $recruiter)
    {
        if ($this->hasRecruiterAssignmentsTable()) {
            $assignedJobIds = DB::table('job_offer_recruiter_assignments as assignments')
                ->join('job_offers as offers', 'offers.id', '=', 'assignments.job_offer_id')
                ->where('assignments.recruiter_id', $recruiter->id)
                ->where('offers.company_id', $recruiter->company_id)
                ->pluck('assignments.job_offer_id');

            if ($assignedJobIds->isNotEmpty()) {
                return $assignedJobIds;
            }
        }

        return DB::table('job_offers')
            ->where('company_id', $recruiter->company_id)
            ->when($recruiter->department_id, function ($q) use ($recruiter) {
                $q->where('department_id', $recruiter->department_id);
            })
            ->pluck('id');
    }

    private function hasRecruiterAssignmentsTable(): bool
    {
        static $exists = null;
        if ($exists === null) {
            $exists = Schema::hasTable('job_offer_recruiter_assignments');
        }

        return (bool) $exists;
    }

    private function hasInterviewRecruiterColumn(): bool
    {
        static $exists = null;
        if ($exists === null) {
            $exists = Schema::hasTable('interviews') && Schema::hasColumn('interviews', 'recruiter_id');
        }

        return (bool) $exists;
    }
}
