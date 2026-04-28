<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobRequirement extends Model
{
    use HasFactory;

    protected $table = 'job_requirements';

    // Disable auto-incrementing since it's a composite key table in SQL
    public $incrementing = false;
    protected $primaryKey = ['job_offer_id', 'skill_id'];
    public $timestamps = false;

    protected $fillable = [
        'job_offer_id',
        'skill_id',
        'weight',
        'experience_levels',
        'required_degrees'
    ];

    protected $casts = [
        'weight' => 'float',
        'experience_levels' => 'array',
        'required_degrees' => 'array',
    ];

    public function jobOffer()
    {
        return $this->belongsTo(JobOffer::class);
    }

    public function skill()
    {
        return $this->belongsTo(Skill::class);
    }
}
