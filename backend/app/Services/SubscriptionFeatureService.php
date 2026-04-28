<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CompanySubscription;
use App\Models\SubscriptionPlan;
use Carbon\Carbon;

class SubscriptionFeatureService
{
    /**
     * Get the active subscription for a company.
     */
    public function getActiveSubscription(Company $company): ?CompanySubscription
    {
        return $company->subscriptions()
            ->where('status', 'active')
            ->where('start_date', '<=', Carbon::now())
            ->where('end_date', '>=', Carbon::now())
            ->with('plan')
            ->first();
    }

    /**
     * Check if a company has AI features enabled in their subscription.
     */
    public function hasAiFeatures(Company $company): bool
    {
        $subscription = $this->getActiveSubscription($company);
        
        if (!$subscription || !$subscription->plan) {
            return false;
        }

        return (bool) $subscription->plan->ai_features_enabled;
    }

    /**
     * Check if a company has chat system enabled in their subscription.
     */
    public function hasChatSystem(Company $company): bool
    {
        $subscription = $this->getActiveSubscription($company);
        
        if (!$subscription || !$subscription->plan) {
            return false;
        }

        return (bool) $subscription->plan->has_advanced_analytics;
    }

    /**
     * Check if a company has AI access enabled in their subscription.
     */
    public function hasAiAccess(Company $company): bool
    {
        $subscription = $this->getActiveSubscription($company);
        
        if (!$subscription || !$subscription->plan) {
            return false;
        }

        return (bool) $subscription->plan->has_ai_access;
    }

    /**
     * Check if a company has priority support enabled in their subscription.
     */
    public function hasPrioritySupport(Company $company): bool
    {
        $subscription = $this->getActiveSubscription($company);
        
        if (!$subscription || !$subscription->plan) {
            return false;
        }

        return (bool) $subscription->plan->has_priority_support;
    }

    /**
     * Check if a company has AI Matching features enabled (AI Scores).
     */
    public function hasAiMatching(Company $company): bool
    {
        return $this->hasAiAccess($company);
    }

    /**
     * Check if a company has AI Analysis features enabled (Job Offer Analysis/RAG).
     */
    public function hasAiAnalysis(Company $company): bool
    {
        return $this->hasAiAccess($company);
    }

    /**
     * Check if a company has AI Quiz/Assessment features enabled.
     */
    public function hasAiQuiz(Company $company): bool
    {
        return $this->hasAiFeatures($company);
    }

    /**
     * Check if a company has Chat System enabled.
     */
    public function hasChatAccess(Company $company): bool
    {
        return $this->hasChatSystem($company);
    }

    /**
     * Get error message for feature not enabled.
     */
    public function getFeatureNotEnabledMessage(string $feature): string
    {
        $featureNames = [
            'ai_features_enabled' => 'AI Assessments',
            'has_ai_access' => 'AI Matching & Analysis',
            'has_advanced_analytics' => 'Internal Chat System',
            'has_priority_support' => 'Priority Support',
            'ai_matching' => 'AI Matching Score',
            'ai_analysis' => 'AI Job Analysis',
            'ai_quiz' => 'AI Assessments',
            'chat' => 'Chat System',
        ];

        $featureName = $featureNames[$feature] ?? str_replace(['has_', '_enabled'], '', $feature);
        $featureName = ucwords(str_replace('_', ' ', $featureName));

        return "The {$featureName} feature is not included in your current subscription plan. Please upgrade your subscription to access this feature.";
    }
}
