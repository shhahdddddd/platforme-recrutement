<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Company;
use App\Models\Admin;
use App\Models\CompanySubscription;
use App\Models\Industry;
use App\Models\SubscriptionPlan;
use App\Services\KeycloakService;
use App\Mail\PasswordChangedMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class CompanyController extends Controller
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    /**
     * Get available industries from database.
     */
    public function industries()
    {
        try {
            $industries = Industry::query()
                ->select(['id', 'name'])
                ->orderBy('name')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $industries
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching industries: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching industries'
            ], 500);
        }
    }

    /**
     * Get full details of a specific company (admin only).
     */
    public function showFullDetails(int $id)
    {
        try {
            $company = Company::with([
                'industry',
                'user',
                'departments',
                'jobOffers' => function ($query) {
                    $query->orderBy('id', 'desc')
                          ->withCount('applications');
                }
            ])->find($id);

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $company
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching company details: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching details',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get public company profile for candidates.
     */
    public function publicProfile(int $id)
    {
        try {
            $company = Company::with([
                'industry',
                'departments',
                'recruiters',
                'jobOffers' => function ($query) {
                    $query->where('status', 'open')
                        ->orderBy('date_posted', 'desc');
                }
            ])->find($id);

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            // Format the response for public view
            $response = [
                'id' => $company->id,
                'name' => $company->name,
                'description' => $company->description,
                'picture' => $company->picture,
                'location' => $company->location,
                'country' => $company->country,
                'industry_id' => $company->industry_id,
                'industry' => $company->industry ? [
                    'id' => $company->industry->id,
                    'name' => $company->industry->name,
                ] : null,
                'employee_count' => $company->employee_count,
                'international' => $company->international,
                'company_type' => $company->company_type,
                'departments_count' => $company->departments->count(),
                'recruiters_count' => $company->recruiters->count(),
                'job_offers' => $company->jobOffers->map(function ($job) {
                    return [
                        'id' => $job->id,
                        'title' => $job->title,
                        'description' => $job->description,
                        'location' => $job->location,
                        'offer_type' => $job->offer_type,
                        'contract_type_detail' => $job->contract_type_detail,
                        'budget' => $job->budget,
                        'status' => $job->status,
                        'date_posted' => $job->date_posted,
                        'department' => $job->department ? [
                            'id' => $job->department->id,
                            'name' => $job->department->name,
                        ] : null,
                        'skills' => $job->skills->pluck('name'),
                    ];
                }),
            ];

            return response()->json([
                'success' => true,
                'data' => $response
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching company public profile: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching company details',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display a listing of companies.
     */
    public function index()
    {
        try {
            $this->syncCompanyAccessWithSubscriptions();

            $today = Carbon::today()->toDateString();

            $companies = Company::with([
                'industry',
                'user',
                'departments' => function ($query) {
                    $query->select(['id', 'company_id', 'name'])
                        ->orderBy('name');
                },
            ]) // eager load industry, user email, and company departments
                ->orderBy('id', 'desc')
                ->get();

            // Add subscription end date to each company
            $companies->each(function ($company) use ($today) {
                $activeSubscription = CompanySubscription::where('company_id', $company->id)
                    ->where('status', 'Active')
                    ->whereDate('start_date', '<=', $today)
                    ->whereDate('end_date', '>', $today)
                    ->orderByDesc('end_date')
                    ->first();

                $latestSubscription = CompanySubscription::where('company_id', $company->id)
                    ->orderByDesc('end_date')
                    ->first();

                $company->subscription_ends_at = $activeSubscription?->end_date ?? $latestSubscription?->end_date;
            });

            return response()->json([
                'success' => true,
                'data' => $companies
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching companies: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching companies',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * List paid company subscriptions with company and plan details (admin only).
     */
    public function subscriptionPayments()
    {
        try {
            $subscriptions = CompanySubscription::with([
                'company:id,name,user_id,company_type',
                'company.user:id,email,is_active',
                'plan:id,name,plan_type,duration_days,price',
            ])
                ->orderByDesc('created_at')
                ->get();

            $data = $subscriptions->map(function (CompanySubscription $subscription) {
                return [
                    'id' => (int) $subscription->id,
                    'company' => [
                        'id' => (int) $subscription->company_id,
                        'name' => (string) ($subscription->company?->name ?? 'Unknown Company'),
                        'email' => $subscription->company?->user?->email,
                        'company_type' => $subscription->company?->company_type,
                        'is_active' => (bool) ($subscription->company?->user?->is_active ?? false),
                    ],
                    'plan' => [
                        'id' => $subscription->plan ? (int) $subscription->plan->id : null,
                        'name' => (string) ($subscription->plan?->name ?? 'N/A'),
                        'plan_type' => $subscription->plan?->plan_type,
                        'duration_days' => $subscription->plan ? (int) $subscription->plan->duration_days : null,
                    ],
                    'amount' => $subscription->amount !== null
                        ? (float) $subscription->amount
                        : ($subscription->plan?->price !== null ? (float) $subscription->plan->price : null),
                    'payment_method' => $subscription->payment_method,
                    'status' => $subscription->status,
                    'start_date' => $subscription->start_date?->toDateString(),
                    'end_date' => $subscription->end_date?->toDateString(),
                    'paid_at' => $subscription->created_at?->toIso8601String(),
                ];
            })->values();

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching subscription payments: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching subscription payments',
            ], 500);
        }
    }

    /**
     * Toggle active status for a company login account (admin only).
     */
    public function toggleStatus(Request $request, int $id)
    {
        try {
            $this->syncCompanyAccessWithSubscriptions();

            $company = Company::with('user')->find($id);

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            if (!$company->user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company account not found'
                ], 404);
            }

            if ($company->user->is_active === true) {
                $company->user->update(['is_active' => false]);

                return response()->json([
                    'success' => true,
                    'message' => 'Company access deactivated.',
                    'company_id' => $company->id,
                    'is_active' => false,
                ]);
            }

            $today = Carbon::today()->toDateString();
            $activeSubscription = CompanySubscription::where('company_id', $company->id)
                ->where('status', 'Active')
                ->whereDate('start_date', '<=', $today)
                ->whereDate('end_date', '>', $today)
                ->orderByDesc('end_date')
                ->first();

            $subscriptionRenewed = false;
            if (!$activeSubscription) {
                $validator = Validator::make($request->all(), [
                    'subscription_plan' => 'required|in:3,6,12',
                    'payment_method' => 'required|string|in:Cash,Bank Transfer,Cheque',
                    'notes' => 'nullable|string',
                ]);

                if ($validator->fails()) {
                    return response()->json([
                        'success' => false,
                        'requires_subscription' => true,
                        'message' => 'Subscription expired. Register a new paid subscription to reactivate this company.',
                        'plans' => $this->reactivationPlanOffers($company->company_type),
                        'errors' => $validator->errors(),
                    ], 422);
                }

                $planMonths = (int) $request->input('subscription_plan');
                $startDate = Carbon::today()->startOfDay();
                $endDate = (clone $startDate)->addMonthsNoOverflow($planMonths);
                $plan = $this->resolvePlanByMonths($planMonths, $company->company_type);
                if (!$plan) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid subscription plan.'
                    ], 422);
                }

                CompanySubscription::where('company_id', $company->id)
                    ->where('status', 'Active')
                    ->update(['status' => 'Expired']);

                $activeSubscription = CompanySubscription::create([
                    'company_id' => $company->id,
                    'plan_id' => $plan->id,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'payment_method' => $request->input('payment_method'),
                    'is_auto_renew' => false,
                    'amount' => $plan->price,
                    'status' => 'Active',
                    'notes' => $request->input('notes'),
                    'created_by' => $this->resolveAdminIdFromRequest($request),
                ]);

                $subscriptionRenewed = true;
            }

            $company->user->update(['is_active' => true]);

            return response()->json([
                'success' => true,
                'message' => $subscriptionRenewed
                    ? 'Company access activated and subscription renewed.'
                    : 'Company access activated.',
                'company_id' => $company->id,
                'is_active' => true,
                'subscription' => $activeSubscription,
            ]);
        } catch (\Exception $e) {
            Log::error('Error toggling company status: ' . $e->getMessage(), [
                'company_id' => $id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update company access.',
            ], 500);
        }
    }

    /**
     * Reactivate a deactivated company with a newly paid subscription (admin only).
     */
    public function reactivateWithSubscription(Request $request, int $id)
    {
        try {
            $this->syncCompanyAccessWithSubscriptions();

            $company = Company::with('user')->find($id);

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            if (!$company->user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company account not found'
                ], 404);
            }

            if ($company->user->is_active === true) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company is already active.'
                ], 422);
            }

            $validator = Validator::make($request->all(), [
                'plan_id' => 'required|integer|exists:subscription_plans,id',
                'payment_method' => 'required|string|in:Cash,Bank Transfer,Cheque',
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Please provide valid subscription payment details.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $plan = SubscriptionPlan::find($request->input('plan_id'));
            if (!$plan) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid subscription plan.'
                ], 422);
            }

            $startDate = Carbon::today()->startOfDay();
            $endDate = (clone $startDate)->addDays($plan->duration_days);

            CompanySubscription::where('company_id', $company->id)
                ->where('status', 'Active')
                ->update(['status' => 'Expired']);

            $subscription = CompanySubscription::create([
                'company_id' => $company->id,
                'plan_id' => $plan->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'payment_method' => $request->input('payment_method'),
                'is_auto_renew' => false,
                'amount' => $plan->price,
                'status' => 'Active',
                'notes' => $request->input('notes'),
                'created_by' => $this->resolveAdminIdFromRequest($request),
            ]);

            $company->user->update(['is_active' => true]);

            return response()->json([
                'success' => true,
                'message' => 'Company reactivated with new paid subscription.',
                'company_id' => $company->id,
                'is_active' => true,
                'subscription' => $subscription,
            ]);
        } catch (\Exception $e) {
            Log::error('Error reactivating company with subscription: ' . $e->getMessage(), [
                'company_id' => $id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to reactivate company subscription.',
            ], 500);
        }
    }

    private function reactivationPlanOffers(?string $planType = null): array
    {
        if (!Schema::hasTable('subscription_plans')) {
            return [];
        }

        $query = SubscriptionPlan::query();

        if ($planType) {
            $query->where('plan_type', $planType);
        }

        return $query
            ->orderBy('price')
            ->get(['id', 'name', 'price', 'duration_days', 'max_job_offers', 'ai_features_enabled'])
            ->map(fn(SubscriptionPlan $plan) => [
                'id' => (int) $plan->id,
                'name' => (string) $plan->name,
                'months' => (int) round(((int) $plan->duration_days) / 30),
                'amount' => (float) $plan->price,
                'duration_days' => (int) $plan->duration_days,
                'max_job_offers' => (int) $plan->max_job_offers,
                'ai_features_enabled' => (bool) $plan->ai_features_enabled,
            ])
            ->values()
            ->all();
    }

    private function syncCompanyAccessWithSubscriptions(): void
    {
        $today = Carbon::today()->toDateString();

        CompanySubscription::where('status', 'Active')
            ->whereDate('end_date', '<=', $today)
            ->update(['status' => 'Expired']);

        $companiesToDeactivate = Company::query()
            ->whereHas('user', function ($query) {
                $query->where('is_active', true);
            })
            ->whereHas('subscriptions', function ($query) use ($today) {
                $query->whereDate('end_date', '<=', $today);
            })
            ->whereDoesntHave('subscriptions', function ($query) use ($today) {
                $query->where('status', 'Active')
                    ->whereDate('start_date', '<=', $today)
                    ->whereDate('end_date', '>', $today);
            })
            ->with('user')
            ->get();

        foreach ($companiesToDeactivate as $company) {
            if ($company->user && $company->user->is_active) {
                $company->user->update(['is_active' => false]);
            }
        }
    }

    private function resolveAdminIdFromRequest(Request $request): ?int
    {
        $creator = $request->user();
        if (!$creator || empty($creator->email)) {
            return null;
        }

        return Admin::where('email', $creator->email)->value('id');
    }

    private function resolvePlanByMonths(int $months, ?string $planType = null): ?SubscriptionPlan
    {
        if (!Schema::hasTable('subscription_plans')) {
            return null;
        }

        $durationDays = $months * 30;
        $query = SubscriptionPlan::query()
            ->where('is_active', true)
            ->whereBetween('duration_days', [$durationDays, $durationDays + 5]);

        if ($planType) {
            $query->where('plan_type', $planType);
        }

        $plan = $query->ordered()->first();
        if ($plan) {
            return $plan;
        }

        $name = match ($months) {
            3 => 'Basic',
            6 => 'Pro',
            12 => 'Premium',
            default => null,
        };

        if (!$name) {
            return null;
        }

        $fallbackQuery = SubscriptionPlan::query()
            ->where('is_active', true)
            ->where('name', $name);

        if ($planType) {
            $fallbackQuery->where('plan_type', $planType);
        }

        return $fallbackQuery->first();
    }

    private function resolvePlanSelection(?int $planId, ?int $planMonths, ?string $planType = null): ?SubscriptionPlan
    {
        if (!Schema::hasTable('subscription_plans')) {
            return null;
        }

        if ($planId) {
            $query = SubscriptionPlan::query()
                ->where('id', $planId)
                ->where('is_active', true);

            if ($planType) {
                $query->where('plan_type', $planType);
            }

            $plan = $query->first();
            if ($plan) {
                return $plan;
            }
        }

        if ($planMonths) {
            return $this->resolvePlanByMonths($planMonths, $planType);
        }

        return null;
    }

    /**
     * Store a newly created company in storage.
     */
    public function store(Request $request)
    {
        Log::info('Company registration request received', $request->all());

        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'company_email' => 'required|email',
                'initial_password' => 'required|string|min:6',
                'location' => 'nullable|string|max:255',
                'industry_id' => 'nullable|string',
                'description' => 'nullable|string',
                'international' => 'boolean',
                'country' => 'nullable|string|max:255',
                // Subscription fields
                'plan_id' => 'nullable|integer|exists:subscription_plans,id',
                'subscription_plan' => 'nullable|in:3,6,12',
                'subscription_start_date' => 'required|date|after_or_equal:today',
                'subscription_end_date' => 'nullable|date|after:subscription_start_date',
                'payment_method' => 'required|string|in:Cash,Bank Transfer,Cheque',
                'notes' => 'nullable|string',
                'company_type' => 'required|string|in:startup,company',
                'employee_count' => 'nullable|integer|min:1',
                'hr_name' => 'nullable|string|max:255',
                'hr_phone' => 'nullable|string|max:255',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation error registering company: ' . json_encode($e->errors()));
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        }

        if (empty($validated['plan_id']) && empty($validated['subscription_plan'])) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'plan_id' => ['Please select a subscription plan.']
                ]
            ], 422);
        }

        try {
            return DB::transaction(function () use ($validated, $request) {
                // 1. Create User in Keycloak first, then in local database
                // Prepare data for Keycloak user creation - lowercase email for consistency
                $email = strtolower($validated['company_email']);
                $userData = [
                    'email' => $email,
                    'password' => $validated['initial_password'],
                    'role' => 'COMPANY',
                ];

                // Create user in Keycloak
                $keycloakUserId = $this->keycloakService->createKeycloakUser($userData);

                if (!$keycloakUserId) {
                    Log::error('CRITICAL: Failed to create user in Keycloak for email: ' . $validated['company_email']);
                    Log::error('User will be created in local database but WILL NOT be able to log in until synced to Keycloak');
                    // Continue anyway - but log the error prominently
                } else {
                    Log::info('User created successfully in Keycloak with ID: ' . $keycloakUserId);
                }

                // Create user in local database
                // Find existing user or create a new one (lowercase email)
                $email = strtolower($validated['company_email']);
                $user = User::where('email', $email)->first();

                if ($user) {
                    Log::info('Updating existing user in local database: ' . $email);
                    $user->update([
                        'role' => 'COMPANY',
                        'is_active' => true,
                    ]);
                } else {
                    Log::info('Creating user in local database with email: ' . $email);
                    $user = User::create([
                        'email' => $email,
                        'password_hash' => Hash::make($validated['initial_password']),
                        'role' => 'COMPANY',
                        'is_active' => true,
                    ]);

                    // Trigger Email Verification for the new company
                    try {
                        event(new \Illuminate\Auth\Events\Registered($user));
                        Log::info('Email verification triggered for company: ' . $email);
                    } catch (\Exception $e) {
                        Log::error('Failed to trigger email verification for company: ' . $e->getMessage());
                    }
                }

                Log::info('User ready in local database with ID: ' . $user->id);
                $industryId = null;
                if (!empty($validated['industry_id'])) {
                    if (is_numeric($validated['industry_id'])) {
                        $industryId = $validated['industry_id'];
                    } else {
                        $industry = \App\Models\Industry::firstOrCreate(['name' => $validated['industry_id']]);
                        $industryId = $industry->id;
                    }
                }

                Log::info('Checking/Creating company for user ID: ' . $user->id);
                $company = Company::where('user_id', $user->id)->first();

                $companyData = [
                    'user_id' => $user->id,
                    'name' => $validated['name'],
                    'description' => $validated['description'] ?? null,
                    'industry_id' => $industryId,
                    'location' => $validated['location'] ?? null,
                    'international' => $validated['international'] ?? false,
                    'country' => $validated['country'] ?? null,
                    'company_type' => $validated['company_type'],
                    'employee_count' => $validated['employee_count'] ?? null,
                ];

                if ($company) {
                    Log::info('Updating existing company for user ID: ' . $user->id);
                    $company->update($companyData);
                } else {
                    Log::info('Creating company for user ID: ' . $user->id);
                    $company = Company::create($companyData);
                }

                Log::info('Company ready with ID: ' . $company->id);

                // 2.5 Create/Update HR Profile for this login
                \App\Models\Hr::updateOrCreate(
                    ['user_id' => $user->id],
                    [
                        'company_id' => $company->id,
                        'full_name' => $validated['hr_name'] ?? 'HR Manager',
                        'phone' => $validated['hr_phone'] ?? null,
                    ]
                );
                // 3. Create Subscription
                $creator = $request->user();
                $adminId = null;

                if ($creator) {
                    // Find matching admin by email to get the correct foreign key ID
                    $admin = \App\Models\Admin::where('email', $creator->email)->first();
                    $adminId = $admin ? $admin->id : null;
                }

                Log::info('Creating subscription for company ID: ' . $company->id);
                $plan = $this->resolvePlanSelection(
                    isset($validated['plan_id']) ? (int) $validated['plan_id'] : null,
                    isset($validated['subscription_plan']) ? (int) $validated['subscription_plan'] : null,
                    $validated['company_type']
                );
                if (!$plan) {
                    throw new \RuntimeException('Invalid subscription plan.');
                }
                $startDate = Carbon::parse($validated['subscription_start_date'])->startOfDay();
                $endDate = (clone $startDate)->addDays((int) $plan->duration_days);

                $subscription = \App\Models\CompanySubscription::create([
                    'company_id' => $company->id,
                    'plan_id' => $plan->id,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'payment_method' => $validated['payment_method'],
                    'is_auto_renew' => false,
                    'amount' => $plan->price,
                    'status' => 'Active',
                    'notes' => $validated['notes'] ?? null,
                    'created_by' => $adminId, // Use the ID from the admins table
                ]);
                Log::info('Subscription created successfully with ID: ' . $subscription->id);

                return response()->json([
                    'success' => true,
                    'message' => 'Company and subscription registered successfully',
                    'data' => [
                        'user' => $user,
                        'company' => $company,
                        'subscription' => $subscription
                    ]
                ], 201);
            });
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation error registering company: ' . json_encode($e->errors()));
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error registering company EXCEPTION: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error registering company',
                'error' => config('app.debug') ? $e->getMessage() : 'An error occurred while registering the company'
            ], 500);
        }
    }



    /**
     * Get the current authenticated company's profile.
     */
    public function show(Request $request)
    {
        $user = $request->user();
        if (!$user->isCompanyAdmin() && !$user->isRecruiter()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Resolve company from admin, recruiter, or hr context
        $company = $user->company
            ?? ($user->recruiter?->company)
            ?? ($user->hr?->company);

        if (!$company) {
            return response()->json(['message' => 'Company profile not found'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $company->load(['industry', 'user'])->makeHidden(['user'])
        ]);
    }

    /**
     * Update the current company's profile.
     */
    public function update(Request $request)
    {
        $user = $request->user();
        if (!$user->isCompanyAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $company = $user->company;
        if (!$company) {
            return response()->json(['message' => 'Company profile not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $user->id,
            'location' => 'nullable|string|max:255',
            'industry_id' => 'nullable', // ID or name
            'description' => 'nullable|string',
            'international' => 'boolean',
            'country' => 'nullable|string|max:255',
            'company_type' => 'sometimes|string|in:startup,company',
        ]);

        try {
            DB::transaction(function () use ($company, $validated, $user) {
                if (isset($validated['email'])) {
                    $oldEmail = strtolower(trim((string) $user->email));
                    $newEmail = strtolower(trim((string) $validated['email']));

                    if ($newEmail !== $oldEmail) {
                        $user->update(['email' => $newEmail]);
                        $this->keycloakService->updateKeycloakEmail($oldEmail, $newEmail);
                    }
                }

                // Handle Industry Logic if provided
                if (isset($validated['industry_id'])) {
                    if (is_numeric($validated['industry_id'])) {
                        $company->industry_id = $validated['industry_id'];
                    } else {
                        $industry = \App\Models\Industry::firstOrCreate(['name' => $validated['industry_id']]);
                        $company->industry_id = $industry->id;
                    }
                }

                // Filter out industry_id from direct update as handled above
                $dataToUpdate = array_filter($validated, function ($key) {
                    return $key !== 'industry_id' && $key !== 'email';
                }, ARRAY_FILTER_USE_KEY);

                if (!empty($dataToUpdate)) {
                    $company->update($dataToUpdate);
                }
            });

            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully',
                'data' => $company->fresh()->load(['industry', 'user'])
            ]);
        } catch (\Exception $e) {
            Log::error('Error updating company profile: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error updating profile',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the current user's password.
     */
    public function updatePassword(Request $request)
    {
        Log::info('Password update attempt for user: ' . $request->user()->email);

        $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        // Cross-Verification Strategy: 
        // We check local DB first. If it fails, we check Keycloak as a fallback.
        if (!Hash::check($request->current_password, $user->password_hash)) {
            Log::info('Local password check failed. Falling back to Keycloak verification...');
            if (!$this->keycloakService->authenticate($user->email, $request->current_password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'The provided current password is incorrect.'
                ], 422);
            }
        }

        try {
            DB::transaction(function () use ($user, $request) {
                // 1. Update local DB hash
                $user->update([
                    'password_hash' => Hash::make($request->new_password)
                ]);

                // 2. Update Keycloak password
                $this->keycloakService->updateKeycloakPassword($user->email, $request->new_password);
            });

            // 3. Send security email notification (outside transaction so it doesn't rollback on email failure)
            try {
                Mail::to($user->email)->send(new PasswordChangedMail($user));
                Log::info("Password changed security notification sent to user: {$user->id} ({$user->email})");
            } catch (\Throwable $e) {
                Log::error("CRITICAL: Failed to send password changed notification", [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                // Don't fail the password change if email fails
            }

            return response()->json([
                'success' => true,
                'message' => 'Password updated successfully across all systems'
            ]);
        } catch (\Exception $e) {
            Log::error('Fatal error during password update: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while updating your password.'
            ], 500);
        }
    }

    /**
     * Get statistics for the company dashboard.
     */
    public function getDashboardStats(Request $request)
    {
        $user = $request->user();
        if (!$user->isCompanyAdmin() && !$user->isRecruiter()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $companyId = null;
        $departmentId = null;

        if ($user->company) {
            $companyId = $user->company->id;
        } elseif ($user->hr) {
            $companyId = $user->hr->company_id;
        } elseif ($user->isRecruiter() && $user->recruiter) {
            $companyId = $user->recruiter->company_id;
            $departmentId = $user->recruiter->department_id;
        }

        if (!$companyId) {
            return response()->json(['message' => 'Profile not found'], 404);
        }

        $company = \App\Models\Company::select(['id', 'company_type'])->find($companyId);
        if (!$company) {
            return response()->json(['message' => 'Profile not found'], 404);
        }

        $jobQuery = \App\Models\JobOffer::where('company_id', $companyId);
        if ($departmentId) {
            $jobQuery->where('department_id', $departmentId);
        }
        $jobIds = (clone $jobQuery)->pluck('id');

        $activeJobsCount = (clone $jobQuery)->where('status', 'open')->count();

        $totalApplicantsCount = \App\Models\Application::whereIn('job_offer_id', $jobIds)
            ->count();

        $companyType = strtolower((string) ($company->company_type ?: 'company'));
        $departmentsEnabled = $companyType !== 'startup';
        $departmentKpis = collect();
        $totalDepartments = 0;

        if ($departmentsEnabled) {
            $departmentBaseQuery = \App\Models\Department::query()
                ->where('company_id', $companyId);

            if ($departmentId) {
                $departmentBaseQuery->where('id', $departmentId);
            }

            $departments = (clone $departmentBaseQuery)
                ->select(['id', 'name'])
                ->orderBy('name')
                ->get();

            $departmentIds = $departments->pluck('id');
            $totalDepartments = $departments->count();

            $offersByDepartment = collect();
            $recruitersByDepartment = collect();

            if ($departmentIds->isNotEmpty()) {
                $offersByDepartment = \App\Models\JobOffer::query()
                    ->select('department_id')
                    ->selectRaw("COUNT(*) as total_offers_count")
                    ->selectRaw("SUM(CASE WHEN offer_type = 'internship' THEN 1 ELSE 0 END) as internship_offers_count")
                    ->where('company_id', $companyId)
                    ->whereIn('department_id', $departmentIds)
                    ->groupBy('department_id')
                    ->get()
                    ->keyBy('department_id');

                $recruitersByDepartment = \App\Models\Recruiter::query()
                    ->select('department_id')
                    ->selectRaw('COUNT(*) as recruiters_count')
                    ->where('company_id', $companyId)
                    ->whereIn('department_id', $departmentIds)
                    ->groupBy('department_id')
                    ->pluck('recruiters_count', 'department_id');
            }

            $departmentKpis = $departments->map(function ($department) use ($offersByDepartment, $recruitersByDepartment) {
                $offerAgg = $offersByDepartment->get($department->id);
                $totalOffersCount = (int) ($offerAgg->total_offers_count ?? 0);
                $internshipOffersCount = (int) ($offerAgg->internship_offers_count ?? 0);
                $jobOffersCount = max(0, $totalOffersCount - $internshipOffersCount);

                return [
                    'department_id' => (int) $department->id,
                    'department_name' => (string) $department->name,
                    'job_offers_count' => $jobOffersCount,
                    'internship_offers_count' => $internshipOffersCount,
                    'total_offers_count' => $totalOffersCount,
                    'recruiters_count' => (int) ($recruitersByDepartment[$department->id] ?? 0),
                ];
            })->values();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'active_jobs' => $activeJobsCount,
                'total_applicants' => $totalApplicantsCount,
                'total_departments' => $totalDepartments,
                'department_kpis' => $departmentKpis,
                'departments_enabled' => $departmentsEnabled,
                'company_type' => $companyType,
            ]
        ]);
    }
}
