<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BinomeInvitation extends Model
{
    use HasFactory;

    protected $table = 'binome_invitations';

    protected $fillable = [
        'application_id',
        'inviter_candidate_id',
        'invited_candidate_id',
        'invited_email',
        'status',
        'responded_at',
        'message',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function inviter()
    {
        return $this->belongsTo(Candidate::class, 'inviter_candidate_id');
    }

    public function invited()
    {
        return $this->belongsTo(Candidate::class, 'invited_candidate_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    public function markAsAccepted(): void
    {
        $this->update([
            'status' => 'accepted',
            'responded_at' => now(),
        ]);
    }

    public function markAsRejected(): void
    {
        $this->update([
            'status' => 'rejected',
            'responded_at' => now(),
        ]);
    }

    public function markAsCancelled(): void
    {
        $this->update([
            'status' => 'cancelled',
            'responded_at' => now(),
        ]);
    }
}
