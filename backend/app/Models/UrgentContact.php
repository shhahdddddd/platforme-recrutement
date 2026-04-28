<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UrgentContact extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'problem_type',
        'description',
        'status',
        'resolved_by',
        'resolved_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function resolvedBy()
    {
        return $this->belongsTo(Admin::class, 'resolved_by');
    }
}
