<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AttendanceScheduleMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $candidateName,
        public string $companyName,
        public string $jobTitle,
        public string $attendanceType,
        public ?array $attendanceSchedule = null,
        public ?string $startDate = null,
        public ?string $endDate = null
    ) {
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Attendance Schedule - ' . $this->companyName,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.attendance-schedule',
            with: [
                'candidateName' => $this->candidateName,
                'companyName' => $this->companyName,
                'jobTitle' => $this->jobTitle,
                'attendanceType' => $this->attendanceType,
                'attendanceSchedule' => $this->attendanceSchedule,
                'startDate' => $this->startDate,
                'endDate' => $this->endDate,
            ]
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
