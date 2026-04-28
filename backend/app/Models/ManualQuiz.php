<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManualQuiz extends Model
{
    protected $fillable = [
        'application_id',
        'recruiter_id',
        'title',
        'description',
        'time_limit',
        'status',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function recruiter()
    {
        return $this->belongsTo(Recruiter::class);
    }

    public function questions()
    {
        return $this->hasMany(ManualQuizQuestion::class)->orderBy('question_number');
    }

    public function answers()
    {
        return $this->hasMany(ManualQuizAnswer::class);
    }
}
