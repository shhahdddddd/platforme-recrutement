<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobOfferLike extends Model
{
    use HasFactory;

    protected $table = 'job_offer_likes';

    protected $fillable = [
        'job_offer_id',
        'user_id',
    ];

    public function jobOffer()
    {
        return $this->belongsTo(JobOffer::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

