<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Interview extends Model
{
    protected $table = 'interviews';

    protected $fillable = [
        'candidate_id',
        'job_offer_id',
        'application_id',
        'conducted_by_hr_id',
        'recruiter_id',
        'scheduled_at',
        'duration_minutes',
        'interview_mode',
        'location',
        'status',
        'interview_type',
        'notes',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    public function candidate()
    {
        return $this->belongsTo(Candidate::class);
    }

    public function jobOffer()
    {
        return $this->belongsTo(JobOffer::class);
    }

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function recruiter()
    {
        return $this->belongsTo(Recruiter::class, 'recruiter_id');
    }
}
