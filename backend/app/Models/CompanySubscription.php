<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanySubscription extends Model
{
    use HasFactory;

    protected $table = 'company_subscriptions';

    protected $fillable = [
        'company_id',
        'plan_id',
        'start_date',
        'end_date',
        'status',
        'payment_method',
        'is_auto_renew',
        'amount',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'status' => 'string',
        'is_auto_renew' => 'boolean',
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public $timestamps = false;

    const CREATED_AT = 'created_at';

    /**
     * Get the company that owns the subscription.
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the selected subscription plan.
     */
    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    /**
     * Get the admin who created the subscription.
     */
    public function creator()
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }
}
