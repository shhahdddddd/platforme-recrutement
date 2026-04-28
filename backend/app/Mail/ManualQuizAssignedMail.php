<?php

namespace App\Mail;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ManualQuizAssignedMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $candidateName;
    public string $jobTitle;
    public string $recruiterName;

    public function __construct(string $candidateName, string $jobTitle, string $recruiterName)
    {
        $this->candidateName = $candidateName;
        $this->jobTitle = $jobTitle;
        $this->recruiterName = $recruiterName;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Nouvel examen technique assigné - ' . $this->jobTitle,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.manual-quiz-assigned',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
