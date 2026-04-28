<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class InternChatMessage extends Model
{
    use HasFactory;

    protected $table = 'intern_chat_messages';

    protected $fillable = [
        'conversation_id',
        'sender_user_id',
        'receiver_user_id',
        'message',
        'attachment_original_name',
        'attachment_path',
        'attachment_mime_type',
        'attachment_size',
        'read_at',
        'is_group_message',
    ];

    protected $casts = [
        'read_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'is_group_message' => 'boolean',
        'attachment_size' => 'integer',
    ];

    public function conversation()
    {
        return $this->belongsTo(InternChatConversation::class, 'conversation_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_user_id');
    }

    public function isGroupMessage(): bool
    {
        return (bool) ($this->attributes['is_group_message'] ?? false);
    }

    public function hasAttachment(): bool
    {
        return filled($this->attachment_path);
    }

    public function getAttachmentDownloadUrlAttribute(): ?string
    {
        if (!$this->hasAttachment()) {
            return null;
        }

        return url('/api/files/chat-attachments/' . basename($this->attachment_path));
    }

    public function getAttachmentExtensionAttribute(): ?string
    {
        if (!$this->hasAttachment()) {
            return null;
        }

        return Str::lower(pathinfo((string) $this->attachment_original_name, PATHINFO_EXTENSION) ?: '');
    }

    public function markAsReadBy(int $userId): void
    {
        // For group messages, we need a separate read receipts table
        // For now, only the specific receiver can mark as read
        if (!$this->isGroupMessage() && (int) $this->receiver_user_id === $userId) {
            $this->update(['read_at' => now()]);
        }
    }
}
