<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class QuizReadyMail extends Mailable
{
    use Queueable, SerializesModels;

    public array $data;

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    public function build(): self
    {
        $quizType = $this->data['quiz_type'] ?? 'ai';
        $subject = $quizType === 'manual'
            ? 'Quiz Manuel Prêt - ' . $this->data['job_title']
            : 'Évaluation Technique AI Prête - ' . $this->data['job_title'];

        return $this
            ->subject($subject)
            ->view('emails.quiz-ready')
            ->with([
                'candidateName' => $this->data['candidate_name'],
                'jobTitle' => $this->data['job_title'],
                'companyName' => $this->data['company_name'],
                'applicationId' => $this->data['application_id'],
                'assessmentUrl' => $this->data['assessment_url'],
                'quizType' => $quizType,
            ]);
    }
}
