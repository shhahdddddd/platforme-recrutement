<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserNotificationCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Notification $notification,
        public int $userId
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->userId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'UserNotificationCreated';
    }

    public function broadcastWith(): array
    {
        $applicationTypes = [
            'NEW_APPLICATION',
            'QUIZ_DRAFT_READY',
            'QUIZ_READY',
            'QUIZ_COMPLETED',
            'MANUAL_QUIZ_READY',
            'INTERVIEW_ASSIGNED',
            'INTERVIEW_SCHEDULED',
            'APPLICATION_REJECTED',
            'APPLICATION_ACCEPTED',
            'INTERN_CHAT_MESSAGE',
            'intern_chat',
        ];

        $type = (string) $this->notification->type;

        return [
            'notification' => [
                'id' => (int) $this->notification->id,
                'title' => $this->notification->title ?: 'Notification',
                'body' => $this->notification->message,
                'message' => $this->notification->message,
                'type' => $type,
                'reference_id' => $this->notification->reference_id !== null ? (int) $this->notification->reference_id : null,
                'application_id' => in_array($type, $applicationTypes, true) && $this->notification->reference_id !== null
                    ? (int) $this->notification->reference_id
                    : null,
                'sent_at' => $this->notification->sent_at?->toIso8601String(),
                'is_read' => (bool) $this->notification->is_read,
                'status' => $this->notification->status,
                'channel' => $this->notification->channel,
                'data' => $this->notification->data ?? [],
            ],
        ];
    }
}
