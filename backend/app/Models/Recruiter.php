<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Model;

class Recruiter extends Model
{
    use HasFactory;

    protected $table = 'recruiters';
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'company_id',
        'department_id',
        'full_name',
        'phone',
        'picture',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function jobOffers(): BelongsToMany
    {
        return $this->belongsToMany(
            JobOffer::class,
            'job_offer_recruiter_assignments',
            'recruiter_id',
            'job_offer_id'
        );
    }
}
