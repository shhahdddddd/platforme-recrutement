<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationRejectedMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $candidateName;
    public string $jobTitle;
    public string $companyName;

    public function __construct(string $candidateName, string $jobTitle, string $companyName)
    {
        $this->candidateName = $candidateName;
        $this->jobTitle = $jobTitle;
        $this->companyName = $companyName;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Mise à jour de votre candidature - RecrutiTN',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application-rejected',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
