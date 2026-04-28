<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class PasswordChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public User $user;
    public string $changedAt;
    public string $userType;

    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct(User $user)
    {
        $this->user = $user;
        $this->changedAt = now()->setTimezone('Africa/Tunis')->format('d/m/Y à H:i');
        
        // Determine user type for personalized message
        if ($user->isCompanyAdmin()) {
            $this->userType = 'RH';
        } elseif ($user->isRecruiter()) {
            $this->userType = 'Recruteur';
        } else {
            $this->userType = 'Utilisateur';
        }
    }

    /**
     * Get the message envelope.
     *
     * @return \Illuminate\Mail\Mailables\Envelope
     */
    public function envelope()
    {
        return new Envelope(
            subject: 'Alerte de sécurité - Mot de passe modifié - RecrutiTN',
        );
    }

    /**
     * Get the message content definition.
     *
     * @return \Illuminate\Mail\Mailables\Content
     */
    public function content()
    {
        return new Content(
            view: 'emails.password-changed',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array
     */
    public function attachments()
    {
        return [];
    }
}
