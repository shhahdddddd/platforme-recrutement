<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\User;
use App\Models\CompanySubscription;
use App\Models\JobOffer;
use App\Models\Application;
use App\Models\Industry;
use App\Services\KeycloakService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AdminDashboardController extends Controller
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    public function getStats(Request $request)
    {
        $lastMonth = now()->subMonth();

        // Platform Revenue
        $totalRevenue = (float) CompanySubscription::sum('amount');
        $lastMonthRevenue = (float) CompanySubscription::where('created_at', '<', $lastMonth)->sum('amount');
        $revenueGrowth = $lastMonthRevenue > 0 ? (($totalRevenue - $lastMonthRevenue) / $lastMonthRevenue) * 100 : 0;

        $totalUsers = User::count();
        $lastMonthUsers = User::where('created_at', '<', $lastMonth)->count();
        $usersGrowth = $lastMonthUsers > 0 ? (($totalUsers - $lastMonthUsers) / $lastMonthUsers) * 100 : 0;

        // Total Enterprise Partners - breakdown by type
        $totalCompanies = Company::count();
        $totalStartups = Company::where('company_type', 'startup')->count();
        $totalEnterprises = Company::where('company_type', 'company')->orWhereNull('company_type')->count();
        $lastMonthCompanies = 0; // Can't calculate growth without proper timestamps
        $companiesGrowth = 0;

        // Total Hires (Accepted Applications) - Note: applications table has no updated_at, only applied_at
        $totalHires = Application::where('status', 'accepted')->count();
        $lastMonthHires = Application::where('status', 'accepted')->where('applied_at', '<', $lastMonth)->count();
        $hiresGrowth = $lastMonthHires > 0 ? (($totalHires - $lastMonthHires) / $lastMonthHires) * 100 : 0;

        // Chart Data (Last 6 months)
        $chartData = $this->getMonthlyChartData();

        Log::info('Dashboard Stats', [
            'total_users' => $totalUsers,
            'total_companies' => $totalCompanies,
            'total_startups' => $totalStartups,
            'total_enterprises' => $totalEnterprises,
            'total_hires' => $totalHires,
            'total_revenue' => $totalRevenue
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'total_revenue' => (float) $totalRevenue,
                'total_users' => $totalUsers,
                'total_companies' => $totalCompanies,
                'total_startups' => $totalStartups,
                'total_enterprises' => $totalEnterprises,
                'total_hires' => $totalHires,
                'revenue_growth' => round($revenueGrowth, 1),
                'users_growth' => round($usersGrowth, 1),
                'companies_growth' => round($companiesGrowth, 1),
                'hires_growth' => round($hiresGrowth, 1),
                'chart_data' => $chartData,
                'company_type_chart' => [
                    'labels' => ['Startups', 'Companies'],
                    'values' => [$totalStartups, $totalEnterprises],
                    'colors' => ['#3B82F6', '#10B981']
                ]
            ]
        ]);
    }

    public function getAdvancedAnalytics(Request $request)
    {
        try {
            // 1. Industry Pie Chart - Companies by Industry
            $totalIndustryCompanies = Industry::withCount('companies')->get()->sum('companies_count');
            $industryStats = Industry::withCount('companies')
                ->get()
                ->map(function ($industry) use ($totalIndustryCompanies) {
                    $percentage = $totalIndustryCompanies > 0
                        ? round(($industry->companies_count / $totalIndustryCompanies) * 100, 1)
                        : 0;

                    return [
                        'name' => $industry->name,
                        'count' => $industry->companies_count,
                        'percentage' => $percentage
                    ];
                });

            // 2. Revenue trend
            $weeklyRevenue = [];
            $weeklyLabels = [];
            $weeklyTotal = 0;
            $allTimeRevenue = (float) CompanySubscription::sum('amount');
            $revenueTrendPeriod = 'Last 7 days';

            for ($i = 6; $i >= 0; $i--) {
                $date = now()->subDays($i);
                $weeklyLabels[] = $date->format('D');
                $dayRevenue = CompanySubscription::whereDate('created_at', $date->toDateString())->sum('amount');
                $weeklyRevenue[] = (float) $dayRevenue;
                $weeklyTotal += $dayRevenue;
            }

            // If there are no payments in the last 7 days, show a broader trend
            // so the chart still reflects real movement from historical data.
            if ($weeklyTotal <= 0 && $allTimeRevenue > 0) {
                $weeklyRevenue = [];
                $weeklyLabels = [];
                $weeklyTotal = 0;
                $revenueTrendPeriod = 'Last 8 weeks';
                $currentWeekStart = now()->copy()->startOfWeek();

                for ($i = 7; $i >= 0; $i--) {
                    $weekStart = $currentWeekStart->copy()->subWeeks($i)->startOfDay();
                    $weekEnd = $weekStart->copy()->endOfWeek()->endOfDay();
                    $weeklyLabels[] = $weekStart->format('d M');
                    $weekRevenue = CompanySubscription::whereBetween('created_at', [$weekStart, $weekEnd])
                        ->sum('amount');
                    $weeklyRevenue[] = (float) $weekRevenue;
                    $weeklyTotal += $weekRevenue;
                }
            }

            // 3. Daily Candidate Signups (last 7 days)
            $dailySignups = [];
            $dailyLabels = [];
            $totalLast7Days = 0;

            for ($i = 6; $i >= 0; $i--) {
                $date = now()->subDays($i);
                $label = $i === 0 ? 'Today' : $date->format('D');
                $dailyLabels[] = $label;

                $count = User::whereIn(DB::raw('LOWER(role)'), ['candidate', 'candidat'])
                    ->whereDate('created_at', $date->toDateString())
                    ->count();

                $dailySignups[] = $count;
                $totalLast7Days += $count;
            }
            $dailyTotal = $totalLast7Days;

            // 4. Company Locations (Tunisia Map)
            $companyLocations = Company::select('location', DB::raw('count(*) as count'))
                ->whereNotNull('location')
                ->groupBy('location')
                ->get()
                ->pluck('count', 'location')
                ->toArray();

            return response()->json([
                'success' => true,
                'data' => [
                    'industry_pie' => $industryStats,
                    'weekly_revenue' => [
                        'labels' => $weeklyLabels,
                        'values' => $weeklyRevenue,
                        'total' => $weeklyTotal
                    ],
                    'total_revenue' => $allTimeRevenue,
                    'revenue_trend_period' => $revenueTrendPeriod,
                    'daily_candidate_signups' => [
                        'labels' => $dailyLabels,
                        'values' => $dailySignups,
                        'total' => $dailyTotal
                    ],
                    'company_locations' => $companyLocations,
                    'updated_at' => now()->toISOString()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error in getAdvancedAnalytics: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());

            return response()->json([
                'success' => false,
                'message' => 'Error loading analytics: ' . $e->getMessage(),
                'data' => [
                    'industry_pie' => [],
                    'weekly_revenue' => ['labels' => [], 'values' => [], 'total' => 0],
                    'total_revenue' => 0,
                    'revenue_trend_period' => 'Last 7 days',
                    'daily_candidate_signups' => ['labels' => [], 'values' => [], 'total' => 0],
                    'updated_at' => now()->toISOString()
                ]
            ], 500);
        }
    }

    private function getMonthlyChartData()
    {
        $months = [];
        $revenue = [];
        $users = [];

        for ($i = 5; $i >= 0; $i--) {
            $date = now()->subMonths($i);
            $monthName = $date->format('M');
            $months[] = $monthName;

            // Get revenue for this specific month
            $monthRevenue = CompanySubscription::whereMonth('created_at', $date->month)
                ->whereYear('created_at', $date->year)
                ->sum('amount');
            $revenue[] = (float) $monthRevenue;

            // Get users for this specific month
            $monthUsers = User::whereMonth('created_at', $date->month)
                ->whereYear('created_at', $date->year)
                ->count();
            $users[] = $monthUsers;
        }

        return [
            'labels' => $months,
            'revenue' => $revenue,
            'users' => $users
        ];
    }

    /**
     * Fix a Keycloak user account
     */
    public function fixKeycloakUser(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email'
        ]);

        try {
            $user = User::where('email', $request->email)->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found in database'
                ], 404);
            }

            Log::info("Admin fixing Keycloak user: {$user->email}");

            $success = $this->keycloakService->fixUserByEmail($user->email);

            if ($success) {
                return response()->json([
                    'success' => true,
                    'message' => 'User account fixed successfully. They can now log in.'
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to fix user. They may not exist in Keycloak.'
                ], 400);
            }
        } catch (\Exception $e) {
            Log::error('Error fixing Keycloak user: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fixing user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sync an existing local user into Keycloak (create if missing, or reset password if exists).
     * Useful when users were created in DB only (or password drifted) and Flutter login returns 401.
     */
    public function syncKeycloakUser(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
            'password' => 'required|string|min:8',
        ]);

        try {
            $user = User::where('email', $request->email)->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found in database'
                ], 404);
            }

            // Map local role to Keycloak attribute role expected by our app
            $roleUpper = strtoupper($user->role ?? '');
            $keycloakRole = match ($roleUpper) {
                'CANDIDATE', 'CANDIDAT' => 'candidate',
                'COMPANY' => 'company',
                'RECRUITER', 'RECRUTEUR' => 'recruiter',
                'ADMIN' => 'admin',
                default => 'candidate',
            };

            Log::info('Admin syncing Keycloak user', [
                'email' => $user->email,
                'local_role' => $user->role,
                'keycloak_role' => $keycloakRole,
            ]);

            $keycloakUserId = $this->keycloakService->createKeycloakUser([
                'email' => $user->email,
                'password' => $request->password,
                'role' => $keycloakRole,
            ]);

            if (!$keycloakUserId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to create/update user in Keycloak. Check server logs.'
                ], 500);
            }

            // Optionally keep local hash in sync (not used for auth, but helps consistency)
            try {
                $user->update(['password_hash' => \Illuminate\Support\Facades\Hash::make($request->password)]);
            } catch (\Throwable $e) {
                // ignore
            }

            return response()->json([
                'success' => true,
                'message' => 'User synced to Keycloak successfully',
                'data' => [
                    'keycloak_user_id' => $keycloakUserId,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error syncing Keycloak user: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error syncing user: ' . $e->getMessage()
            ], 500);
        }
    }
}
