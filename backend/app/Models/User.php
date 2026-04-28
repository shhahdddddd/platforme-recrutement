<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory, Notifiable;

    /**
     * The table associated with the model.
     */
    protected $table = 'users';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'email',
        'password_hash',
        'role',
        'last_login',
        'is_active',
        'fcm_token',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password_hash',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'created_at' => 'datetime',
        'last_login' => 'datetime',
        'last_seen_at' => 'datetime',
        'is_active' => 'boolean',
        'is_online' => 'boolean',
        'email_verified_at' => 'datetime',
    ];

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    /**
     * Get the password for the user (Laravel Auth compatibility)
     */
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    /**
     * Get the candidate profile associated with the user.
     */
    public function candidate()
    {
        return $this->hasOne(Candidate::class);
    }

    /**
     * Get the company profile associated with the user.
     */
    public function company()
    {
        return $this->hasOne(Company::class);
    }

    /**
     * Recruiter profile attached to this user.
     */
    public function recruiter()
    {
        return $this->hasOne(Recruiter::class);
    }

    /**
     * HR profile attached to this user (if company role).
     */
    public function hr()
    {
        return $this->hasOne(Hr::class);
    }


    /**
     * Get notifications for the user.
     */
    public function userNotifications()
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * FCM tokens for the user (multiple devices/platforms).
     */
    public function fcmTokens()
    {
        return $this->hasMany(FcmToken::class);
    }

    /**
     * Get the saved jobs for the user.
     */
    public function savedJobs()
    {
        return $this->hasMany(SavedJob::class);
    }

    public function normalizedRole(): string
    {
        return strtolower((string) $this->role);
    }

    public function isCandidate(): bool
    {
        // Single canonical role name — normalized to lowercase.
        // 'candidat' (FR) is intentionally removed to prevent silent auth bugs.
        return $this->normalizedRole() === 'candidate';
    }

    public function isCompanyAdmin(): bool
    {
        return in_array($this->normalizedRole(), ['company', 'company_admin'], true);
    }

    public function isRecruiter(): bool
    {
        // Single canonical role name — normalized to lowercase.
        // 'recruteur' (FR) is intentionally removed to prevent silent auth bugs.
        return in_array($this->normalizedRole(), ['recruiter', 'recruteur'], true);
    }

    public function isAdmin(): bool
    {
        return in_array($this->normalizedRole(), ['admin', 'superadmin'], true);
    }

}
