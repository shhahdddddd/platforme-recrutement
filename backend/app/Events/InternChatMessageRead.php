<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InternChatMessageRead implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $conversationId;
    public int $readerUserId;
    public array $messageIds;
    public string $readAt;

    public function __construct(
        int $conversationId,
        int $readerUserId,
        array $messageIds,
        string $readAt
    ) {
        $this->conversationId = $conversationId;
        $this->readerUserId = $readerUserId;
        $this->messageIds = $messageIds;
        $this->readAt = $readAt;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('chat.conversation.' . $this->conversationId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'InternChatMessageRead';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'reader_user_id' => $this->readerUserId,
            'message_ids' => $this->messageIds,
            'read_at' => $this->readAt,
        ];
    }
}
