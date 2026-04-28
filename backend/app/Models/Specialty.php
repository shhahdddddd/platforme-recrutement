<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Specialty extends Model
{
    use HasFactory;

    protected $table = 'specialties';

    protected $fillable = [
        'name',
        'category',
        'created_by',
    ];

    public $timestamps = false;

    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }
}
