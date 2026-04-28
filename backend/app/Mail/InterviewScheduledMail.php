<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InterviewScheduledMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $candidateName;
    public string $jobTitle;
    public string $companyName;
    public string $interviewType;
    public string $interviewMode;
    public string $scheduledAtLabel;
    public ?int $durationMinutes;
    public ?string $notes;

    public function __construct(
        string $candidateName,
        string $jobTitle,
        string $companyName,
        string $interviewType,
        string $interviewMode,
        string $scheduledAtLabel,
        ?int $durationMinutes = null,
        ?string $notes = null
    ) {
        $this->candidateName = $candidateName;
        $this->jobTitle = $jobTitle;
        $this->companyName = $companyName;
        $this->interviewType = $interviewType;
        $this->interviewMode = $interviewMode;
        $this->scheduledAtLabel = $scheduledAtLabel;
        $this->durationMinutes = $durationMinutes;
        $this->notes = $notes;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Interview scheduled - RecrutiTN',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.interview-scheduled',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
