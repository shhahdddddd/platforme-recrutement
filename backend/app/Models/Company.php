<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    use HasFactory;

    protected $table = 'companies';

    protected $fillable = [
        'user_id',
        'picture',
        'name',
        'description',
        'industry_id',
        'location',
        'international',
        'country',
        'company_type',
        'employee_count',
    ];

    protected $casts = [
        'international' => 'boolean',
        'created_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    /**
     * Get the user that owns the company profile.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the industry of the company.
     */
    public function industry()
    {
        return $this->belongsTo(Industry::class);
    }

    /**
     * Get job offers posted by the company.
     */
    public function jobOffers()
    {
        return $this->hasMany(JobOffer::class);
    }

    /**
     * Get subscriptions for the company.
     */
    public function subscriptions()
    {
        return $this->hasMany(CompanySubscription::class);
    }

    public function recruiters()
    {
        return $this->hasMany(Recruiter::class);
    }

    public function departments()
    {
        return $this->hasMany(Department::class);
    }

    public function hr()
    {
        return $this->hasOne(Hr::class);
    }

    public function documents()
    {
        return $this->hasMany(CompanyDocument::class);
    }
    public function getPictureAttribute($value)
    {
        if (!$value)
            return null;
        if (str_starts_with($value, 'http')) {
            $filename = basename($value);
            return url('/api/files/profiles/' . $filename);
        }
        return url('/api/files/profiles/' . basename($value));
    }
}
