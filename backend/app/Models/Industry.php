<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Industry extends Model
{
    use HasFactory;

    protected $table = 'industries';

    protected $fillable = [
        'name',
        'description',
        'created_by',
    ];

    public $timestamps = false;

    public function companies()
    {
        return $this->hasMany(Company::class);
    }
}
