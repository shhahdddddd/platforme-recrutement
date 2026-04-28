<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    use HasFactory;

    protected $table = 'applications';
    public $timestamps = false; // The migration uses a default NOW() for applied_at

    protected $fillable = [
        'candidate_id',
        'job_offer_id',
        'cv_path',
        'status',
        'applied_at',
        'ai_match_score',
        'ai_semantic_score',
        'ai_skill_score',
        'ai_experience_score',
        'ai_degree_score',
        'ai_scored_at',
        'ai_error',
        'ai_confidence_score',
        'ai_explanation',
        'interview_launched_at',
        'ai_quiz_session_id',
        'ai_quiz_status',
        'ai_quiz_score',
        'ai_quiz_error',
        'ai_quiz_sent_at',
        'ai_quiz_completed_at',
        'manual_quiz_score',
        'manual_quiz_status',
        'manual_quiz_completed_at',
        'attendance',
        'attendance_schedule',
    ];

    protected $casts = [
        'applied_at' => 'datetime',
        'ai_match_score' => 'float',
        'ai_semantic_score' => 'float',
        'ai_skill_score' => 'float',
        'ai_experience_score' => 'float',
        'ai_degree_score' => 'float',
        'ai_scored_at' => 'datetime',
        'ai_confidence_score' => 'float',
        'ai_explanation' => 'array',
        'interview_launched_at' => 'datetime',
        'ai_quiz_score' => 'float',
        'ai_quiz_sent_at' => 'datetime',
        'ai_quiz_completed_at' => 'datetime',
        'manual_quiz_score' => 'float',
        'manual_quiz_completed_at' => 'datetime',
        'deleted_at' => 'datetime',
        'attendance_schedule' => 'array',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function jobOffer()
    {
        return $this->belongsTo(JobOffer::class);
    }

    public function interview()
    {
        return $this->hasOne(Interview::class);
    }

    public function interviews()
    {
        return $this->hasMany(Interview::class, 'application_id');
    }

    public function manualQuiz()
    {
        return $this->hasOne(ManualQuiz::class);
    }

    public function internChatConversation()
    {
        return $this->hasOne(InternChatConversation::class, 'application_id');
    }

    public function binomeInvitations()
    {
        return $this->hasMany(BinomeInvitation::class);
    }

    public function activeBinomeInvitation()
    {
        return $this->hasOne(BinomeInvitation::class)
            ->whereIn('status', ['pending', 'accepted']);
    }

    public function acceptedBinome()
    {
        return $this->hasOne(BinomeInvitation::class)
            ->where('status', 'accepted');
    }

    /**
     * Ensure the CV path URL uses the current APP_URL and protocol.
     * Falls back to the candidate's latest CV if the original application file was deleted.
     */
    public function getCvPathAttribute($value)
    {
        if (!$value)
            return null;

        // Extract filename from stored value
        $filename = basename($value);

        // Check if the original file still exists on disk
        $storagePath = 'cvs/' . $filename;
        if (\Illuminate\Support\Facades\Storage::disk('public')->exists($storagePath)) {
            return url('/api/files/cvs/' . $filename);
        }

        // Fallback: try the candidate's latest CV from cv_files
        if ($this->candidate_id) {
            $candidate = Candidate::find($this->candidate_id);
            if ($candidate) {
                $latestPath = $candidate->latestCvStoragePath();
                if ($latestPath) {
                    return url('/api/files/cvs/' . basename($latestPath));
                }
            }
        }

        // Last resort: return the URL anyway (will 404 but at least it's a valid URL)
        return url('/api/files/cvs/' . $filename);
    }
}
