<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Hr extends Model
{
    use HasFactory;

    protected $table = 'hr';

    protected $fillable = [
        'user_id',
        'company_id',
        'full_name',
        'phone',
        'picture',
        'last_login',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'last_login' => 'datetime',
    ];

    public $timestamps = false; // We use database default for created_at

    /**
     * Get the user that owns the HR profile.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the company the HR manager belongs to.
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Helper to get picture URL.
     */
    public function getPictureAttribute($value)
    {
        if (!$value)
            return null;
        if (str_starts_with($value, 'http')) {
            return url('/api/files/profiles/' . basename($value));
        }
        return url('/api/files/profiles/' . basename($value));
    }
}
