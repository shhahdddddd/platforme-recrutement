<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InternChatConversation extends Model
{
    use HasFactory;

    protected $table = 'intern_chat_conversations';

    protected $fillable = [
        'application_id',
        'company_id',
        'recruiter_id',
        'candidate_id',
        'binome_candidate_id',
        'conversation_type',
        'last_message_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'conversation_type' => 'string',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function recruiter()
    {
        return $this->belongsTo(Recruiter::class);
    }

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function binome()
    {
        return $this->belongsTo(Candidate::class, 'binome_candidate_id');
    }

    public function messages()
    {
        return $this->hasMany(InternChatMessage::class, 'conversation_id');
    }

    public function latestMessage()
    {
        return $this->hasOne(InternChatMessage::class, 'conversation_id')->latestOfMany();
    }

    public function isDuo(): bool
    {
        return $this->binome_candidate_id !== null;
    }

    public function isSolo(): bool
    {
        return $this->binome_candidate_id === null;
    }

    public function getConversationTypeAttribute($value): string
    {
        return $this->binome_candidate_id !== null ? 'duo' : 'solo';
    }

    public function getAllParticipantUserIds(): array
    {
        $userIds = [];
        
        if ($this->recruiter?->user_id) {
            $userIds[] = $this->recruiter->user_id;
        }
        
        if ($this->candidate?->user_id) {
            $userIds[] = $this->candidate->user_id;
        }
        
        if ($this->binome?->user_id) {
            $userIds[] = $this->binome->user_id;
        }
        
        return array_unique($userIds);
    }

    public function canAddBinome(): bool
    {
        return $this->isSolo() && $this->binome_candidate_id === null;
    }
}
