<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobOffer;
use App\Models\CompanySubscription;
use App\Models\Department;
use App\Models\Recruiter;
use App\Services\CompanyRealtimeNotificationService;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class JobOfferController extends Controller
{
    public function __construct(
        private CompanyRealtimeNotificationService $companyRealtimeNotificationService,
        private \App\Services\SubscriptionFeatureService $subscriptionFeatureService
    ) {
    }

    /**
     * Display a listing of job offers for the authenticated company.
     */
    public function index(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
            }

            Log::info('JobOffer index for user', ['user_id' => $user->id, 'email' => $user->email, 'role' => $user->role]);

            $relations = ['department', 'recruiters.user'];

            $query = JobOffer::with($relations)
                ->withCount('applications')
                ->orderBy('id', 'desc');

            if (!$this->applyOfferOwnershipScope($query, $user)) {
                Log::warning('Ownership scope failed for user', ['user_id' => $user->id]);
                return response()->json(['success' => false, 'message' => 'Profile not found'], 404);
            }

            $offers = $query->get();
            Log::info('Job offers retrieved', ['count' => $offers->count()]);

            $data = $this->appendTableRequirements($offers);

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            Log::error('JobOffer index error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'user_id' => $request->user()?->id
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error loading job offers: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created job offer.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isCompanyAdmin() && !$user->isRecruiter())) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $user->company ?? ($user->recruiter?->company);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Profile not found'], 404);
        }

        $companyId = (int) $company->id;
        $departmentsEnabled = $this->companyUsesDepartments($company);

        $request->validate([
            'title'                 => 'required|string|max:255',
            'description'           => 'required|string',
            'quiz_questions_count'  => 'nullable|integer|min:5|max:15',
            'location'              => 'nullable|string|max:255',
            'offer_type'            => 'nullable|in:fulltime,parttime,internship',
            'budget'                => 'nullable|numeric|min:0',
            'duration_months'       => 'nullable|integer|min:1',
            'internship_start_date' => 'nullable|date',
            'department_id'         => $departmentsEnabled ? 'required|integer' : 'nullable|integer',
            'recruiter_ids'         => 'nullable|array',
            'recruiter_ids.*'       => 'integer',
        ]);

        $departmentIdForOffer = null;
        if ($departmentsEnabled) {
            $department = Department::where('id', (int) $request->department_id)
                ->where('company_id', $companyId)
                ->first();

            if (!$department) {
                return response()->json([
                    'success' => false,
                    'message' => 'Department does not belong to this company',
                ], 422);
            }

            $departmentIdForOffer = (int) $department->id;
        }

        $recruiterIds = $this->normalizeRecruiterIds($request->input('recruiter_ids', []));
        
        // ... (auth and active company checks skipped for brevity in this replace block, but they are in the file)

        // Step 2.2 - Lightweight preparation (Call Django AI) - Only if subscription allows
        $aiAnalysis = [
            'knowledge_base_ready' => false,
            'relevant_clusters' => [],
            'key_terms' => [],
            'warning' => null
        ];

        if ($this->subscriptionFeatureService->hasAiAnalysis($company)) {
            try {
                $response = \Illuminate\Support\Facades\Http::timeout(10)->post(env('AI_SERVICE_URL', 'http://127.0.0.1:8002') . '/api/job-offers/analyze/', [
                    'description' => $request->description,
                    'company_id' => $companyId
                ]);

                if ($response->successful()) {
                    $aiAnalysis = $response->json();
                } else {
                    Log::warning('AI Analysis service failed', ['status' => $response->status()]);
                }
            } catch (\Exception $e) {
                Log::error('AI Analysis connection failed: ' . $e->getMessage());
            }
        } else {
            Log::info('Skipping AI Job Analysis for company (Subscription restricted)', ['company_id' => $companyId]);
            $aiAnalysis['warning'] = $this->subscriptionFeatureService->getFeatureNotEnabledMessage('ai_analysis');
        }

        try {
            return DB::transaction(function () use ($request, $companyId, $departmentIdForOffer, $recruiterIds, $aiAnalysis) {
                $jobOffer = JobOffer::create([
                    'company_id' => $companyId,
                    'department_id' => $departmentIdForOffer,
                    'title' => $request->title,
                    'description' => $request->description,
                    'location' => $request->location ?? 'Remote',
                    'offer_type' => $request->offer_type ?? 'fulltime',
                    'contract_type_detail' => ($request->offer_type === 'internship') ? null : $this->normalizeContractType($request->contract_type_detail ?? 'CDI'),
                    'budget' => $request->budget,
                    'status' => 'open',
                    'date_posted' => now()->toDateString(),

                    // AI Fields (defaults when not provided by frontend)
                    'quiz_questions_count' => $request->quiz_questions_count ?? 8,
                    'relevant_clusters' => $aiAnalysis['relevant_clusters'] ?? [],
                    'key_terms' => $aiAnalysis['key_terms'] ?? [],
                    'knowledge_base_ready' => $aiAnalysis['knowledge_base_ready'] ?? false,
                    'preparation_error' => $aiAnalysis['warning'] ?? null
                ]);

                $this->upsertOfferRequirements($jobOffer, $request);
                $this->syncOfferRecruiters($jobOffer, $recruiterIds);

                DB::afterCommit(function () use ($jobOffer) {
                    $this->companyRealtimeNotificationService->notifyJobPostedToCandidates($jobOffer->load('company.user'));
                    $this->companyRealtimeNotificationService->notifyJobPostedToRecruiters($jobOffer);
                });

                $jobOffer->load(['department', 'company', 'recruiters.user']);
                $results = $this->appendTableRequirements(collect([$jobOffer]));
                $payload = !empty($results) ? $results[0] : null;

                return response()->json([
                    'success' => true,
                    'message' => 'Job offer posted successfully',
                    'data' => $payload
                ]);
            });
        } catch (\Exception $e) {
            Log::error('Error creating job offer: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error creating job offer: ' . $e->getMessage()
            ], 500);
        }
    }

    public function show(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user || (!$user->isCompanyAdmin() && !$user->isRecruiter())) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $relations = ['department', 'company', 'recruiters.user'];
        if ($this->hasRequirementsTable('job_requirements')) {
            $relations[] = 'jobRequirements';
        }
        if ($this->hasRequirementsTable('internship_requirements')) {
            $relations[] = 'internshipRequirements';
        }

        $query = JobOffer::with($relations);
        if (!$this->applyOfferOwnershipScope($query, $user)) {
            return response()->json(['success' => false, 'message' => 'Profile not found'], 404);
        }

        $offer = $query->where('id', $id)->first();
        if (!$offer) {
            return response()->json(['success' => false, 'message' => 'Offer not found'], 404);
        }

        $result = $this->appendTableRequirements(collect([$offer]));

        return response()->json([
            'success' => true,
            'data' => !empty($result) ? $result[0] : null,
        ]);
    }

    public function update(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user || (!$user->isCompanyAdmin() && !$user->isRecruiter())) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $offerQuery = JobOffer::query()->where('id', $id);
        if (!$this->applyOfferOwnershipScope($offerQuery, $user)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $offer = $offerQuery->first();
        if (!$offer) {
            return response()->json(['success' => false, 'message' => 'Offer not found'], 404);
        }

        $company = $user->company ?? ($user->recruiter?->company);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Profile not found'], 404);
        }

        $company->loadMissing('user');
        if ($company->user && $company->user->is_active === false) {
            return response()->json([
                'success' => false,
                'message' => 'Company access is deactivated by admin. You cannot edit job offers.'
            ], 403);
        }

        $companyId = (int) $company->id;
        $departmentsEnabled = $this->companyUsesDepartments($company);

        $request->validate([
            'title'                 => 'required|string|max:255',
            'description'           => 'required|string',
            'location'              => 'required|string|max:255',
            'offer_type'            => 'required|in:fulltime,parttime,internship',
            'contract_type_detail'  => 'nullable|in:CIVP,CDI,CDD,ALTERNANCE,INTERNSHIP',
            'budget'                => 'nullable|numeric',
            'required_degrees'      => 'nullable|array',
            'experience_levels'     => 'nullable|array',
            'duration_months'       => 'nullable|integer|min:1',
            'internship_start_date' => 'nullable|date',
            'department_id'         => $departmentsEnabled ? 'required|integer' : 'nullable|integer',
            'recruiter_ids'         => 'nullable|array',
            'recruiter_ids.*'       => 'integer',
        ]);

        $departmentIdForOffer = null;
        if ($departmentsEnabled) {
            $department = Department::where('id', (int) $request->department_id)
                ->where('company_id', $companyId)
                ->first();

            if (!$department) {
                return response()->json([
                    'success' => false,
                    'message' => 'Department does not belong to this company',
                ], 422);
            }

            $departmentIdForOffer = (int) $department->id;
        }

        $recruiterIds = $this->normalizeRecruiterIds($request->input('recruiter_ids', []));
        if (!$this->validateRecruiterAssignments($companyId, $departmentIdForOffer, $departmentsEnabled, $recruiterIds)) {
            return response()->json([
                'success' => false,
                'message' => 'One or more recruiters are invalid for this company or department.',
            ], 422);
        }

        try {
            return DB::transaction(function () use ($request, $offer, $departmentIdForOffer, $recruiterIds) {
                $offer->update([
                    'department_id'        => $departmentIdForOffer,
                    'title'                => $request->title,
                    'description'          => $request->description,
                    'location'             => $request->location,
                    'offer_type'           => $request->offer_type,
                    'contract_type_detail' => ($request->offer_type === 'internship') ? null : $this->normalizeContractType($request->contract_type_detail),
                    'budget'               => $request->budget,
                ]);

                $this->upsertOfferRequirements($offer, $request);
                $this->syncOfferRecruiters($offer, $recruiterIds);

                // Track changed fields for notification
                $changedFields = [];
                if ($offer->wasChanged('title')) $changedFields[] = 'title';
                if ($offer->wasChanged('description')) $changedFields[] = 'description';
                if ($offer->wasChanged('location')) $changedFields[] = 'location';
                if ($offer->wasChanged('status')) $changedFields[] = 'status';
                if ($offer->wasChanged('budget')) $changedFields[] = 'budget';
                if ($offer->wasChanged('department_id')) $changedFields[] = 'department';

                // Notify recruiters about the update
                if (!empty($changedFields)) {
                    DB::afterCommit(function () use ($offer, $changedFields) {
                        $this->companyRealtimeNotificationService->notifyJobUpdatedToRecruiters($offer, $changedFields);
                    });
                }

                $offer->load(['department', 'company', 'recruiters.user']);
                $result = $this->appendTableRequirements(collect([$offer]));

                return response()->json([
                    'success' => true,
                    'message' => 'Job offer updated successfully',
                    'data' => !empty($result) ? $result[0] : null,
                ]);
            });
        } catch (\Exception $e) {
            Log::error('Error updating job offer: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error updating job offer: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the status of a job offer.
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|string|max:50' // Support flexible statuses like 'pas active'
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $user->company ?? ($user->recruiter?->company);
        if ($company) {
            $company->loadMissing('user');
            if ($company->user && $company->user->is_active === false) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company access is deactivated by admin. You cannot modify job offers.'
                ], 403);
            }
        }

        $query = JobOffer::query()->where('id', $id);
        if (!$this->applyOfferOwnershipScope($query, $user)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $offer = $query->first();
        if (!$offer) {
            return response()->json(['success' => false, 'message' => 'Offer not found'], 404);
        }

        $offer->update(['status' => $request->status]);

        // Notify recruiters about status change
        DB::afterCommit(function () use ($offer) {
            $this->companyRealtimeNotificationService->notifyJobUpdatedToRecruiters($offer, ['status']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Job status updated successfully',
            'data' => $offer
        ]);
    }

    /**
     * Delete a job offer.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $user->company ?? ($user->recruiter?->company);
        if ($company) {
            $company->loadMissing('user');
            if ($company->user && $company->user->is_active === false) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company access is deactivated by admin. You cannot modify job offers.'
                ], 403);
            }
        }

        $query = JobOffer::query()->where('id', $id);
        if (!$this->applyOfferOwnershipScope($query, $user)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $offer = $query->first();
        if (!$offer) {
            return response()->json(['success' => false, 'message' => 'Offer not found'], 404);
        }

        // Store info before deletion for notification
        $companyId = $offer->company_id;
        $jobTitle = $offer->title;
        $jobId = $offer->id;

        $offer->delete();

        // Notify recruiters about the deletion
        DB::afterCommit(function () use ($companyId, $jobTitle, $jobId) {
            $this->companyRealtimeNotificationService->notifyJobDeletedToRecruiters($companyId, $jobTitle, $jobId);
        });

        return response()->json([
            'success' => true,
            'message' => 'Job offer deleted successfully'
        ]);
    }
    /**
     * Get all active job offers (for candidates/public feed).
     */
    public function getAllJobOffers()
    {
        $today = now()->toDateString();

        $relations = ['company', 'department'];
        if ($this->hasRequirementsTable('job_requirements')) {
            $relations[] = 'jobRequirements';
        }
        if ($this->hasRequirementsTable('internship_requirements')) {
            $relations[] = 'internshipRequirements';
        }

        $offers = JobOffer::whereRaw('LOWER(status) = ?', ['open'])
            ->whereHas('company', function ($query) use ($today) {
                $query->whereHas('subscriptions', function ($subQuery) use ($today) {
                    $subQuery->whereRaw('LOWER(status) = ?', ['active'])
                        ->whereDate('start_date', '<=', $today)
                        ->whereDate('end_date', '>', $today);
                });
            })
            ->withCount(['likes', 'comments'])
            ->with($relations)
            ->latest('date_posted')
            ->get();
        $data = $this->appendTableRequirements($offers);

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    public function requirements($id)
    {
        $offer = JobOffer::query()->select(['id', 'offer_type'])->find($id);
        if (!$offer) {
            return response()->json([
                'success' => false,
                'message' => 'Offer not found',
            ], 404);
        }

        $isInternship = $offer->offer_type === 'internship';
        $table = $isInternship ? 'internship_requirements' : 'job_requirements';

        if (!$this->hasRequirementsTable($table)) {
            return response()->json([
                'success' => true,
                'data' => [
                    'job_offer_id' => $offer->id,
                    'offer_type' => $offer->offer_type,
                    'source_table' => $table,
                    'requirements' => [],
                ],
            ]);
        }

        $query = DB::table($table . ' as r')->where('r.job_offer_id', $offer->id);

        if ($isInternship) {
            $rows = $query
                ->select([
                    'r.required_degrees',
                    'r.duration_months',
                    DB::raw('r.duration_months as month_durations'),
                ])
                ->distinct()
                ->get();
        } else {
            $rows = $query
                ->select([
                    'r.required_degrees',
                ])
                ->distinct()
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'job_offer_id' => $offer->id,
                'offer_type' => $offer->offer_type,
                'source_table' => $table,
                'requirements' => $rows,
            ],
        ]);
    }

    private function upsertOfferRequirements(JobOffer $jobOffer, Request $request): void
    {
        $isInternship = $request->offer_type === 'internship';

        if ($isInternship) {
            if ($this->hasRequirementsTable('job_requirements')) {
                DB::table('job_requirements')
                    ->where('job_offer_id', $jobOffer->id)
                    ->delete();
            }

            if ($this->hasRequirementsTable('internship_requirements')) {
                DB::table('internship_requirements')->updateOrInsert(
                    [
                        'job_offer_id' => $jobOffer->id,
                    ],
                    [
                        'minimum_level' => null,
                        'required_degrees' => isset($request->required_degrees) ? json_encode($request->required_degrees) : null,
                        'duration_months' => $request->duration_months,
                        'start_date' => $request->internship_start_date,
                    ]
                );
            } else {
                Log::warning('Skipping internship requirement upsert because table is missing.', [
                    'table' => 'internship_requirements',
                    'job_offer_id' => $jobOffer->id,
                ]);
            }

            return;
        }

        if ($this->hasRequirementsTable('internship_requirements')) {
            DB::table('internship_requirements')
                ->where('job_offer_id', $jobOffer->id)
                ->delete();
        }

        if ($this->hasRequirementsTable('job_requirements')) {
            DB::table('job_requirements')->updateOrInsert(
                [
                    'job_offer_id' => $jobOffer->id,
                ],
                [
                    'weight' => 1.0,
                    'experience_levels' => isset($request->experience_levels) ? json_encode($request->experience_levels) : null,
                    'required_degrees' => isset($request->required_degrees) ? json_encode($request->required_degrees) : null,
                ]
            );
        } else {
            Log::warning('Skipping job requirement upsert because table is missing.', [
                'table' => 'job_requirements',
                'job_offer_id' => $jobOffer->id,
            ]);
        }
    }

    private function normalizeContractType(?string $contractType): ?string
    {
        if ($contractType === 'CDI') {
            return 'CID';
        }

        if ($contractType === 'CIVP') {
            return 'CVP';
        }

        if ($contractType === 'INTERNSHIP') {
            return 'Internship';
        }

        return $contractType;
    }

    private function applyOfferOwnershipScope($query, $user): bool
    {
        if ($user->company) {
            $query->where('company_id', $user->company->id);
            return true;
        }

        if ($user->isRecruiter() && $user->recruiter) {
            $recruiter = $user->recruiter;
            $query->where('company_id', $recruiter->company_id);

            // Get IDs of jobs where the recruiter has assigned interviews
            $interviewJobIds = DB::table('interviews')
                ->where('recruiter_id', $recruiter->id)
                ->pluck('job_offer_id')
                ->unique()
                ->toArray();

            $query->where(function ($q) use ($recruiter, $interviewJobIds) {
                // 1. Jobs in their department
                if ($recruiter->department_id) {
                    $q->where('department_id', $recruiter->department_id);
                }

                // 2. Jobs where they are manually assigned
                if ($this->hasRecruiterAssignmentsTable()) {
                    $assignedIds = DB::table('job_offer_recruiter_assignments')
                        ->where('recruiter_id', $recruiter->id)
                        ->pluck('job_offer_id')
                        ->toArray();
                    if (!empty($assignedIds)) {
                        $q->orWhereIn('id', $assignedIds);
                    }
                }

                // 3. Jobs where they have active interviews
                if (!empty($interviewJobIds)) {
                    $q->orWhereIn('id', $interviewJobIds);
                }
            });

            return true;
        }

        return false;
    }

    private function companyUsesDepartments($company): bool
    {
        return strtolower((string) ($company->company_type ?: 'company')) !== 'startup';
    }

    private function normalizeRecruiterIds(mixed $rawIds): array
    {
        if (!is_array($rawIds)) {
            return [];
        }

        return collect($rawIds)
            ->map(fn($id) => (int) $id)
            ->filter(fn($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function validateRecruiterAssignments(
        int $companyId,
        ?int $departmentId,
        bool $departmentsEnabled,
        array $recruiterIds
    ): bool {
        if (empty($recruiterIds)) {
            return true;
        }

        $query = Recruiter::query()
            ->where('company_id', $companyId)
            ->whereIn('id', $recruiterIds);

        if ($departmentsEnabled && $departmentId) {
            $query->where('department_id', $departmentId);
        }

        $validCount = (int) $query->count();

        return $validCount === count($recruiterIds);
    }

    private function syncOfferRecruiters(JobOffer $offer, array $recruiterIds): void
    {
        if (!$this->hasRecruiterAssignmentsTable()) {
            return;
        }

        $offer->recruiters()->sync($recruiterIds);
    }

    private function appendTableRequirements($offers)
    {
        $collection = collect($offers)->values();
        if ($collection->isEmpty()) {
            return [];
        }

        $offerIds = $collection->pluck('id')->filter()->values()->all();

        $jobReqByOffer = collect();
        if ($this->hasRequirementsTable('job_requirements')) {
            $jobReqByOffer = DB::table('job_requirements as jr')
                ->whereIn('jr.job_offer_id', $offerIds)
                ->select([
                    'jr.job_offer_id',
                    'jr.experience_levels',
                    'jr.required_degrees',
                ])
                ->get()
                ->groupBy('job_offer_id');
        }

        $internReqByOffer = collect();
        if ($this->hasRequirementsTable('internship_requirements')) {
            $internReqByOffer = DB::table('internship_requirements as ir')
                ->whereIn('ir.job_offer_id', $offerIds)
                ->select([
                    'ir.job_offer_id',
                    'ir.minimum_level',
                    'ir.required_degrees',
                    'ir.duration_months',
                    'ir.start_date',
                ])
                ->get()
                ->groupBy('job_offer_id');
        }

        return $collection->map(function ($offer) use ($jobReqByOffer, $internReqByOffer) {
            $row = $offer instanceof JobOffer ? $offer->toArray() : (array) $offer;
            $id = $row['id'] ?? null;

            $row['job_requirements'] = ($jobReqByOffer->get($id) ?? collect())
                ->map(function($r) {
                    $item = (array) $r;
                    if (isset($item['required_degrees']) && is_string($item['required_degrees'])) {
                        $item['required_degrees'] = json_decode($item['required_degrees'], true);
                    }
                    if (isset($item['experience_levels']) && is_string($item['experience_levels'])) {
                        $item['experience_levels'] = json_decode($item['experience_levels'], true);
                    }
                    return $item;
                })
                ->values()
                ->all();

            $row['internship_requirements'] = ($internReqByOffer->get($id) ?? collect())
                ->map(function($r) {
                    $item = (array) $r;
                    if (isset($item['required_degrees']) && is_string($item['required_degrees'])) {
                        $item['required_degrees'] = json_decode($item['required_degrees'], true);
                    }
                    return $item;
                })
                ->values()
                ->all();

            return $row;
        })->values()->all();
    }

    private function hasRecruiterAssignmentsTable(): bool
    {
        static $exists = null;

        if ($exists === null) {
            $exists = Schema::hasTable('job_offer_recruiter_assignments');
        }

        return (bool) $exists;
    }

    private function hasRequirementsTable(string $table): bool
    {
        static $tableExistence = [];

        if (!array_key_exists($table, $tableExistence)) {
            $tableExistence[$table] = Schema::hasTable($table);
        }

        return $tableExistence[$table];
    }
}
