<?php

namespace App\Events;

use App\Models\InternChatMessage;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InternChatMessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public InternChatMessage $message;
    public int $conversationId;
    public int $receiverUserId;
    public array $conversationData;

    public function __construct(
        InternChatMessage $message,
        int $conversationId,
        int $receiverUserId,
        array $conversationData = []
    ) {
        $this->message = $message;
        $this->conversationId = $conversationId;
        $this->receiverUserId = $receiverUserId;
        $this->conversationData = $conversationData;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('chat.conversation.' . $this->conversationId),
            new PrivateChannel('user.' . $this->receiverUserId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'InternChatMessageSent';
    }

    public function broadcastWith(): array
    {
        return [
            'message' => [
                'id' => $this->message->id,
                'message' => $this->message->message,
                'created_at' => $this->message->created_at?->toIso8601String(),
                'read_at' => $this->message->read_at?->toIso8601String(),
                'sender_user_id' => $this->message->sender_user_id,
                'receiver_user_id' => $this->message->receiver_user_id,
                'attachment' => $this->message->hasAttachment() ? [
                    'original_name' => $this->message->attachment_original_name,
                    'file_size' => $this->message->attachment_size,
                    'mime_type' => $this->message->attachment_mime_type,
                    'download_url' => $this->message->attachment_download_url,
                    'extension' => $this->message->attachment_extension,
                ] : null,
                'sender' => [
                    'id' => $this->message->sender?->id,
                    'email' => $this->message->sender?->email,
                    'role' => $this->message->sender?->role,
                ],
            ],
            'conversation' => $this->conversationData,
        ];
    }
}
