<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanySubscription;
use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class CompanySubscriptionController extends Controller
{
    /**
     * Get the current company's subscription status.
     * Accessible by Company Admin.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $companyId = $this->resolveCompanyId($user);

        if (!$companyId) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        $subscriptions = CompanySubscription::with('plan')
            ->where('company_id', $companyId)
            ->orderByDesc('end_date')
            ->get();

        $activeSubscription = $subscriptions->where('status', 'active')->first();

        return response()->json([
            'success' => true,
            'data' => [
                'active' => $activeSubscription,
                'history' => $subscriptions
            ]
        ]);
    }

    /**
     * Renew or create a subscription (Manual/Admin only).
     * Only Admin users.
     */
    public function renew(Request $request)
    {
        $request->validate([
            'plan_months' => 'required|in:3,6,12',
            'payment_method' => 'required|string|in:Cash,Bank Transfer,Cheque',
            'is_auto_renew' => 'nullable|boolean',
        ]);

        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $companyId = $request->company_id;
        if (!$companyId) {
            return response()->json(['success' => false, 'message' => 'Company ID is required'], 422);
        }

        $planMonths = (int) $request->plan_months;
        $plan = $this->resolvePlanByMonths($planMonths);
        if (!$plan) {
            return response()->json(['success' => false, 'message' => 'Invalid plan selection'], 422);
        }

        $startDate = now();
        $endDate = now()->addDays((int) $plan->duration_days);

        CompanySubscription::where('company_id', $companyId)
            ->where('status', 'Active')
            ->update(['status' => 'Expired']);

        $subscription = CompanySubscription::create([
            'company_id' => $companyId,
            'plan_id' => $plan->id,
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'payment_method' => $request->payment_method,
            'is_auto_renew' => (bool) $request->boolean('is_auto_renew', false),
            'amount' => $plan->price,
            'status' => 'Active',
            'notes' => 'Subscription created by Admin: ' . $user->email,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Subscription created successfully',
            'data' => $subscription
        ]);
    }

    /**
     * Cancel a subscription (Admin only).
     */
    public function cancel(Request $request)
    {
        $request->validate([
            'subscription_id' => 'required|integer',
        ]);

        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $subscription = CompanySubscription::find($request->subscription_id);
        if (!$subscription) {
            return response()->json(['success' => false, 'message' => 'Subscription not found'], 404);
        }

        $subscription->update([
            'status' => 'Suspended',
            'notes' => 'Cancelled by Admin: ' . $user->email . ' on ' . now()->toDateString()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Subscription cancelled successfully',
            'data' => $subscription
        ]);
    }

    private function resolveCompanyId($user): ?int
    {
        if ($user->company) {
            return $user->company->id;
        }
        if ($user->hr && $user->hr->company) {
            return $user->hr->company_id;
        }

        return null;
    }

    private function resolvePlanByMonths(int $planMonths): ?SubscriptionPlan
    {
        if (!Schema::hasTable('subscription_plans')) {
            return null;
        }

        $name = match ($planMonths) {
            3 => 'Basic',
            6 => 'Pro',
            12 => 'Premium',
            default => null,
        };

        if (!$name) {
            return null;
        }

        return SubscriptionPlan::where('name', $name)->first();
    }
}
