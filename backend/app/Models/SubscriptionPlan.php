<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    use HasFactory;

    protected $table = 'subscription_plans';

    protected $fillable = [
        'name',
        'plan_type',
        'description',
        'price',
        'duration_days',
        'max_job_offers',
        'max_job_posts',
        'ai_features_enabled',
        'has_ai_access',
        'has_priority_support',
        'has_advanced_analytics',
        'is_active',
        'display_order',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'duration_days' => 'integer',
        'max_job_offers' => 'integer',
        'max_job_posts' => 'integer',
        'ai_features_enabled' => 'boolean',
        'has_ai_access' => 'boolean',
        'has_priority_support' => 'boolean',
        'has_advanced_analytics' => 'boolean',
        'is_active' => 'boolean',
        'display_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function subscriptions()
    {
        return $this->hasMany(CompanySubscription::class, 'plan_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForCompanies($query)
    {
        return $query->where('plan_type', 'company');
    }

    public function scopeForStartups($query)
    {
        return $query->where('plan_type', 'startup');
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order')->orderBy('id');
    }

    public function isForCompany(): bool
    {
        return $this->plan_type === 'company';
    }

    public function isForStartup(): bool
    {
        return $this->plan_type === 'startup';
    }
}

