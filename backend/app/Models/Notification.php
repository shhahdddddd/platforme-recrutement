<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'type',
        'reference_id',
        'channel',
        'message',
        'data',
        'is_read',
        'sent_at',
        'status',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'data' => 'array',
        'is_read' => 'boolean',
    ];

    public $timestamps = false; // No created_at/updated_at in user's schema

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
