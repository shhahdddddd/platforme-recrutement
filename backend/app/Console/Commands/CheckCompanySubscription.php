<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Company;
use App\Models\CompanySubscription;
use Carbon\Carbon;

class CheckCompanySubscription extends Command
{
    protected $signature = 'check:subscription {company=numeryx}';
    protected $description = 'Check subscription status for a company';

    public function handle()
    {
        $companyName = $this->argument('company');
        
        $company = Company::where('name', $companyName)->first();
        
        if (!$company) {
            $this->error("Company '$companyName' not found");
            return 1;
        }
        
        $this->info("Company: {$company->name} (ID: {$company->id})");
        $this->info("User active: " . ($company->user?->is_active ? 'Yes' : 'No'));
        $this->newLine();
        
        $subscriptions = CompanySubscription::where('company_id', $company->id)
            ->orderBy('end_date', 'desc')
            ->get();
        
        if ($subscriptions->isEmpty()) {
            $this->warn('No subscriptions found');
            return 0;
        }
        
        $today = Carbon::today();
        $this->info("Today's date: {$today->toDateString()}");
        $this->newLine();
        
        foreach ($subscriptions as $sub) {
            $endDate = Carbon::parse($sub->end_date);
            $expired = $endDate->lt($today);
            
            $this->info("Subscription ID: {$sub->id}");
            $this->info("  Plan ID: {$sub->plan_id}");
            $this->info("  Start: {$sub->start_date}");
            $this->info("  End: {$sub->end_date}");
            $this->info("  Status: {$sub->status}");
            $this->info("  Expired: " . ($expired ? 'YES' : 'No'));
            $this->newLine();
        }
        
        // Check what the API would return
        $activeSub = $subscriptions->firstWhere('status', 'Active');
        $latestSub = $subscriptions->first();
        $endDate = $activeSub?->end_date ?? $latestSub?->end_date;
        
        $this->info("API would return: subscription_ends_at = " . ($endDate ?? 'null'));
        
        return 0;
    }
}
