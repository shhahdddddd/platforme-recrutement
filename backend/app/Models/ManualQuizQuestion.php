<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManualQuizQuestion extends Model
{
    protected $fillable = [
        'manual_quiz_id',
        'question_text',
        'choices',
        'correct_choice',
        'explanation',
        'difficulty',
        'question_number',
        'category',
        'points',
    ];

    protected $casts = [
        'choices' => 'array',
    ];

    public function manualQuiz()
    {
        return $this->belongsTo(ManualQuiz::class);
    }

    public function answers()
    {
        return $this->hasMany(ManualQuizAnswer::class, 'manual_quiz_question_id');
    }
}
