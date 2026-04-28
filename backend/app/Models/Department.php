<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use HasFactory;

    protected $table = 'departments';
    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'name',
        'description',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function recruiters()
    {
        return $this->hasMany(Recruiter::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function jobOffers()
    {
        return $this->hasMany(JobOffer::class);
    }
}
