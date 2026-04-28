<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManualQuizAnswer extends Model
{
    protected $fillable = [
        'manual_quiz_id',
        'manual_quiz_question_id',
        'selected_choice',
        'is_correct',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
    ];

    public function manualQuiz()
    {
        return $this->belongsTo(ManualQuiz::class);
    }

    public function question()
    {
        return $this->belongsTo(ManualQuizQuestion::class, 'manual_quiz_question_id');
    }
}
