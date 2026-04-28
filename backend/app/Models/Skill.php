<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Skill extends Model
{
    use HasFactory;

    protected $table = 'skills';

    protected $fillable = ['name', 'category'];

    public function jobOffers()
    {
        return $this->belongsToMany(JobOffer::class, 'job_requirements')
            ->withPivot(['weight', 'experience_levels', 'required_degrees']);
    }
}
