<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SubscriptionPlanController extends Controller
{
    /**
     * Get all subscription plans (admin view - includes inactive).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $planType = $request->input('plan_type');
        $includeInactive = $request->boolean('include_inactive', false);

        $query = SubscriptionPlan::query();

        if ($planType) {
            $query->where('plan_type', $planType);
        }

        if (!$includeInactive) {
            $query->where('is_active', true);
        }

        $plans = $query->ordered()->get();

        return response()->json([
            'success' => true,
            'data' => $plans
        ]);
    }

    /**
     * Get single subscription plan details.
     */
    public function show(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $plan = SubscriptionPlan::find($id);

        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription plan not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $plan
        ]);
    }

    /**
     * Create a new subscription plan.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:subscription_plans,name',
            'plan_type' => 'required|in:company,startup',
            'description' => 'nullable|string|max:500',
            'price' => 'required|numeric|min:0|max:999999.99',
            'duration_days' => 'required|integer|min:1|max:1095',
            'max_job_offers' => 'required|integer|min:0',
            'max_job_posts' => 'required|integer|min:0',
            'ai_features_enabled' => 'boolean',
            'has_ai_access' => 'boolean',
            'has_priority_support' => 'boolean',
            'has_advanced_analytics' => 'boolean',
            'is_active' => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $plan = SubscriptionPlan::create($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Subscription plan created successfully',
            'data' => $plan
        ], 201);
    }

    /**
     * Update a subscription plan.
     */
    public function update(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $plan = SubscriptionPlan::find($id);

        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription plan not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100|unique:subscription_plans,name,' . $id,
            'plan_type' => 'sometimes|in:company,startup',
            'description' => 'nullable|string|max:500',
            'price' => 'sometimes|numeric|min:0|max:999999.99',
            'duration_days' => 'sometimes|integer|min:1|max:1095',
            'max_job_offers' => 'sometimes|integer|min:0',
            'max_job_posts' => 'sometimes|integer|min:0',
            'ai_features_enabled' => 'boolean',
            'has_ai_access' => 'boolean',
            'has_priority_support' => 'boolean',
            'has_advanced_analytics' => 'boolean',
            'is_active' => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $plan->update($validator->validated());

        return response()->json([
            'success' => true,
            'message' => 'Subscription plan updated successfully',
            'data' => $plan
        ]);
    }

    /**
     * Delete a subscription plan (soft delete by deactivating).
     */
    public function destroy(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $plan = SubscriptionPlan::find($id);

        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription plan not found'
            ], 404);
        }

        // Check if plan has active subscriptions
        $activeSubscriptions = $plan->subscriptions()->where('status', 'Active')->count();

        if ($activeSubscriptions > 0) {
            // Soft delete by deactivating
            $plan->update(['is_active' => false]);

            return response()->json([
                'success' => true,
                'message' => 'Subscription plan deactivated (has active subscriptions)'
            ]);
        }

        // Hard delete if no active subscriptions
        $plan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Subscription plan deleted successfully'
        ]);
    }

    /**
     * Toggle plan active status.
     */
    public function toggleStatus(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $plan = SubscriptionPlan::find($id);

        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Subscription plan not found'
            ], 404);
        }

        $plan->update(['is_active' => !$plan->is_active]);

        return response()->json([
            'success' => true,
            'message' => 'Subscription plan ' . ($plan->is_active ? 'activated' : 'deactivated'),
            'data' => $plan
        ]);
    }

    /**
     * Reorder subscription plans.
     */
    public function reorder(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'orders' => 'required|array',
            'orders.*.id' => 'required|integer|exists:subscription_plans,id',
            'orders.*.display_order' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        foreach ($request->input('orders') as $order) {
            SubscriptionPlan::where('id', $order['id'])
                ->update(['display_order' => $order['display_order']]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Plans reordered successfully'
        ]);
    }

    /**
     * Public endpoint: Get pricing for companies (public view).
     */
    public function pricing(Request $request)
    {
        $planType = $request->input('plan_type', 'company');

        $query = SubscriptionPlan::query()
            ->where('is_active', true);

        if ($planType === 'startup') {
            $query->forStartups();
        } else {
            $query->forCompanies();
        }

        $plans = $query->ordered()->get([
            'id',
            'name',
            'plan_type',
            'description',
            'price',
            'duration_days',
            'max_job_posts',
            'has_ai_access',
            'has_priority_support',
            'has_advanced_analytics',
        ]);

        // Format for display
        $formattedPlans = $plans->map(function ($plan) {
            $months = floor($plan->duration_days / 30);
            $years = floor($plan->duration_days / 365);

            return [
                'id' => $plan->id,
                'name' => $plan->name,
                'plan_type' => $plan->plan_type,
                'description' => $plan->description,
                'price' => (float) $plan->price,
                'duration_months' => $months,
                'duration_text' => $years >= 1 ? $years . ' year' . ($years > 1 ? 's' : '') : $months . ' months',
                'features' => [
                    'max_job_posts' => $plan->max_job_posts,
                    'ai_access' => $plan->has_ai_access,
                    'priority_support' => $plan->has_priority_support,
                    'advanced_analytics' => $plan->has_advanced_analytics,
                ],
                'feature_list' => $this->buildFeatureList($plan),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'plan_type' => $planType,
                'plans' => $formattedPlans,
            ]
        ]);
    }

    /**
     * Build human-readable feature list for pricing display.
     */
    private function buildFeatureList(SubscriptionPlan $plan): array
    {
        $features = [
            sprintf('Up to %d job postings', $plan->max_job_posts),
            sprintf('%s AI-powered matching', $plan->has_ai_access ? '✓' : '✗'),
            sprintf('%s Priority support', $plan->has_priority_support ? '✓' : '✗'),
            sprintf('%s Advanced analytics', $plan->has_advanced_analytics ? '✓' : '✗'),
        ];

        return $features;
    }
}
