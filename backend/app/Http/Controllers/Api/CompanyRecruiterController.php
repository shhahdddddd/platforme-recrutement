<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Department;
use App\Models\Recruiter;
use App\Models\User;
use App\Services\KeycloakService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CompanyRecruiterController extends Controller
{
    public function __construct(private KeycloakService $keycloakService)
    {
    }

    public function listDepartments(Request $request)
    {
        $user = $request->user();
        $company = $this->resolveCompany($user);

        if (!$company) {
            return response()->json([
                'success' => true,
                'data' => [],
                'company_resolved' => false,
                'company_type' => null,
                'departments_enabled' => false,
                'can_manage_departments' => false,
            ]);
        }

        $departmentsEnabled = $this->companyUsesDepartments($company);
        $departments = $departmentsEnabled
            ? Department::where('company_id', $company->id)->orderBy('name', 'asc')->get()
            : collect();

        return response()->json([
            'success' => true,
            'data' => $departments,
            'company_resolved' => true,
            'company_type' => strtolower((string) ($company->company_type ?: 'company')),
            'departments_enabled' => $departmentsEnabled,
            'can_manage_departments' => (bool) ($user?->isCompanyAdmin()),
        ]);
    }

    public function createDepartment(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $this->resolveCompany($user);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        if (!$this->companyUsesDepartments($company)) {
            return response()->json([
                'success' => false,
                'message' => 'Startups do not use departments.',
            ], 422);
        }

        $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
        ]);

        $name = $this->normalizeDepartmentName((string) $request->name);
        if ($name === '') {
            return response()->json([
                'success' => false,
                'message' => 'Department name is required.',
            ], 422);
        }

        $duplicate = Department::where('company_id', $company->id)
            ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($name)])
            ->first();

        if ($duplicate) {
            return response()->json([
                'success' => false,
                'message' => 'Department already exists for this company.',
            ], 422);
        }

        $department = Department::create([
            'company_id' => $company->id,
            'name' => $name,
            'description' => $request->description,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Department created successfully.',
            'data' => $department,
        ], 201);
    }

    public function updateDepartment(Request $request, int $departmentId)
    {
        $user = $request->user();
        if (!$user || !$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $this->resolveCompany($user);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        if (!$this->companyUsesDepartments($company)) {
            return response()->json([
                'success' => false,
                'message' => 'Startups do not use departments.',
            ], 422);
        }

        $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
        ]);

        $department = Department::where('id', $departmentId)
            ->where('company_id', $company->id)
            ->first();

        if (!$department) {
            return response()->json(['success' => false, 'message' => 'Department not found'], 404);
        }

        $name = $this->normalizeDepartmentName((string) $request->name);
        if ($name === '') {
            return response()->json([
                'success' => false,
                'message' => 'Department name is required.',
            ], 422);
        }

        $duplicate = Department::where('company_id', $company->id)
            ->where('id', '!=', $department->id)
            ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($name)])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'success' => false,
                'message' => 'Department already exists for this company.',
            ], 422);
        }

        $department->update([
            'name' => $name,
            'description' => $request->description,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Department updated successfully.',
            'data' => $department->fresh(),
        ]);
    }

    public function deleteDepartment(Request $request, int $departmentId)
    {
        $user = $request->user();
        if (!$user || !$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $this->resolveCompany($user);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        if (!$this->companyUsesDepartments($company)) {
            return response()->json([
                'success' => false,
                'message' => 'Startups do not use departments.',
            ], 422);
        }

        $department = Department::where('id', $departmentId)
            ->where('company_id', $company->id)
            ->first();

        if (!$department) {
            return response()->json(['success' => false, 'message' => 'Department not found'], 404);
        }

        $inUseByRecruiters = Recruiter::where('company_id', $company->id)
            ->where('department_id', $department->id)
            ->exists();

        $inUseByJobOffers = DB::table('job_offers')
            ->where('company_id', $company->id)
            ->where('department_id', $department->id)
            ->exists();

        if ($inUseByRecruiters || $inUseByJobOffers) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete this department while it is assigned to recruiters or job offers.',
            ], 422);
        }

        $department->delete();

        return response()->json([
            'success' => true,
            'message' => 'Department deleted successfully.',
        ]);
    }


    public function listRecruiters(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $this->resolveCompany($user);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        $recruitersQuery = Recruiter::with(['department', 'user'])
            ->where('company_id', $company->id)
            ->latest('created_at');

        if ($request->filled('department_id')) {
            $departmentId = (int) $request->query('department_id');
            if ($departmentId <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid department filter.',
                ], 422);
            }

            $department = Department::where('company_id', $company->id)
                ->where('id', $departmentId)
                ->first();

            if (!$department) {
                return response()->json([
                    'success' => false,
                    'message' => 'Department not found for this company.',
                ], 422);
            }

            $recruitersQuery->where('department_id', $departmentId);
        }

        $recruiters = $recruitersQuery->get();

        return response()->json(['success' => true, 'data' => $recruiters]);
    }

    public function showRecruiter(Request $request, int $recruiterId)
    {
        $user = $request->user();
        if (!$user || !$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $this->resolveCompany($user);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        $recruiter = Recruiter::with(['department', 'user', 'company'])
            ->where('id', $recruiterId)
            ->where('company_id', $company->id)
            ->first();

        if (!$recruiter) {
            return response()->json(['success' => false, 'message' => 'Recruiter not found'], 404);
        }

        return response()->json(['success' => true, 'data' => $recruiter]);
    }

    public function createRecruiter(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $this->resolveCompany($user);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        $departmentsEnabled = $this->companyUsesDepartments($company);

        $request->validate([
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'full_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'picture' => 'nullable|string|max:255',
            'department_id' => $departmentsEnabled ? 'required|integer' : 'nullable|integer',
        ]);

        $department = null;
        if ($departmentsEnabled) {
            $department = $this->findCompanyDepartment($company->id, (int) $request->department_id);
            if (!$department) {
                return response()->json([
                    'success' => false,
                    'message' => 'Department not found for this company',
                ], 422);
            }
        }

        $names = preg_split('/\s+/', trim($request->full_name));
        $firstName = $names[0] ?? 'Recruiter';
        $lastName = count($names) > 1 ? implode(' ', array_slice($names, 1)) : 'Recruiter';

        $newUser = DB::transaction(function () use ($request, $company, $department, $firstName, $lastName) {
            $createdUser = $this->keycloakService->createUser([
                'email' => strtolower(trim($request->email)),
                'password' => $request->password,
                // Use realm role name expected by Keycloak, keep local DB role normalized below.
                'role' => 'recruiter',
                'first_name' => $firstName,
                'last_name' => $lastName,
                'phone' => $request->phone,
                'location' => $company->location,
            ]);

            if (!$createdUser) {
                throw new \RuntimeException('Failed to create recruiter user');
            }

            $createdUser->update(['role' => 'recruteur']);

            if ($createdUser) {
                try {
                    event(new \Illuminate\Auth\Events\Registered($createdUser));
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning('Verification email failed for recruiter: ' . $e->getMessage());
                }
            }

            Recruiter::create([
                'user_id' => $createdUser->id,
                'company_id' => $company->id,
                'department_id' => $department?->id,
                'full_name' => trim($request->full_name),
                'phone' => $request->phone,
                'picture' => $request->picture,
            ]);

            return $createdUser;
        });

        return response()->json([
            'success' => true,
            'message' => 'Recruiter created successfully',
            'data' => Recruiter::with(['department', 'user'])->where('user_id', $newUser->id)->first(),
        ], 201);
    }

    public function toggleRecruiterStatus(Request $request, int $recruiterId)
    {
        $user = $request->user();
        if (!$user || !$user->isCompanyAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $company = $this->resolveCompany($user);
        if (!$company) {
            return response()->json(['success' => false, 'message' => 'Company profile not found'], 404);
        }

        $recruiter = Recruiter::with('user')
            ->where('id', $recruiterId)
            ->where('company_id', $company->id)
            ->first();

        if (!$recruiter) {
            return response()->json(['success' => false, 'message' => 'Recruiter not found'], 404);
        }

        $recruiterUser = $recruiter->user;
        if (!$recruiterUser) {
            return response()->json(['success' => false, 'message' => 'Recruiter user account not found'], 404);
        }

        // Toggle the active status
        $newStatus = !$recruiterUser->is_active;
        $recruiterUser->update(['is_active' => $newStatus]);

        // Sync with Keycloak: enable or disable the user
        try {
            $adminToken = $this->keycloakService->getAdminAccessTokenPublic();
            if ($adminToken) {
                $keycloakUser = $this->keycloakService->findKeycloakUserByEmail($recruiterUser->email, $adminToken);
                if ($keycloakUser) {
                    $this->keycloakService->setKeycloakUserEnabled($keycloakUser['id'], $newStatus, $adminToken);
                }
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('Keycloak status sync failed for recruiter: ' . $e->getMessage());
        }

        $action = $newStatus ? 'activated' : 'deactivated';

        return response()->json([
            'success' => true,
            'message' => "Recruiter account {$action} successfully.",
            'is_active' => $newStatus,
        ]);
    }

    private function resolveCompany(?User $user): ?Company
    {
        if (!$user) {
            return null;
        }

        if ($user->company) {
            return $user->company;
        }

        if ($user->hr && $user->hr->company) {
            return $user->hr->company;
        }

        if ($user->isRecruiter() && $user->recruiter && $user->recruiter->company) {
            return $user->recruiter->company;
        }


        return null;
    }

    private function companyUsesDepartments(Company $company): bool
    {
        return strtolower((string) ($company->company_type ?: 'company')) !== 'startup';
    }

    private function findCompanyDepartment(int $companyId, int $departmentId): ?Department
    {
        if ($departmentId <= 0) {
            return null;
        }

        return Department::where('company_id', $companyId)
            ->where('id', $departmentId)
            ->first();
    }

    private function normalizeDepartmentName(string $name): string
    {
        return trim(preg_replace('/\s+/', ' ', $name) ?? '');
    }
}
