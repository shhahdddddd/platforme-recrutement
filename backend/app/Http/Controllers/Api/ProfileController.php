<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Services\CompanyRealtimeNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    protected $authService;
    protected CompanyRealtimeNotificationService $companyRealtimeNotificationService;

    public function __construct(
        \App\Services\AuthService $authService,
        CompanyRealtimeNotificationService $companyRealtimeNotificationService
    ) {
        $this->authService = $authService;
        $this->companyRealtimeNotificationService = $companyRealtimeNotificationService;
    }

    public function updatePicture(Request $request)
    {
        \Illuminate\Support\Facades\Log::info('Profile picture update request received', [
            'has_file' => $request->hasFile('picture'),
            'file_name' => $request->hasFile('picture') ? $request->file('picture')->getClientOriginalName() : 'none',
            'file_type' => $request->hasFile('picture') ? $request->file('picture')->getClientMimeType() : 'none'
        ]);

        try {
            $request->validate([
                'picture' => 'required|image|mimes:jpg,jpeg,png|max:5120', // Max 5MB, only JPG/PNG
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::error('Validation failed for profile picture', ['errors' => $e->errors()]);
            throw $e;
        }

        $user = Auth::user();
        \Illuminate\Support\Facades\Log::info('User authenticated for upload', ['user_id' => $user->id, 'role' => $user->role]);

        $path = $request->file('picture')->store('profiles', 'public');
        \Illuminate\Support\Facades\Log::info('File stored at', ['path' => $path]);
        // Generate a CORS-friendly URL via our new API route
        $filename = basename($path);
        $fullPath = url('/api/files/profiles/' . $filename);

        // Update the specific role profile
        if ($user->isCandidate()) {
            $user->candidate->update(['picture' => $fullPath]);
        } elseif ($user->isCompanyAdmin()) {
            // Resolve the company through direct or HR relationship
            $company = $user->company;
            if (!$company && $user->hr) {
                $company = $user->hr->company;
            }
            // Update company logo
            if ($company) {
                $company->update(['picture' => $fullPath]);
            }
            // Update HR manager's personal picture
            if ($user->hr) {
                $user->hr->update(['picture' => $fullPath]);
            }
        } elseif ($user->isRecruiter() && $user->recruiter) {
            $user->recruiter->update(['picture' => $fullPath]);
        }

        // Invalidate Redis cache so the new profile is fetched on next login/refresh
        $this->authService->invalidateProfileCache($user->id);

        return response()->json([
            'success' => true,
            'message' => 'Profile picture updated',
            'data' => [
                'picture_url' => $fullPath
            ]
        ]);
    }

    public function update(Request $request)
    {
        $user = Auth::user();

        // Update Candidate profile fields
        if ($user->isCandidate()) {
            $updateData = [];

            $skillsUpdated = false;
            $educationUpdated = false;

            if ($request->has('skills')) {
                $skillsData = $request->input('skills');
                if (is_string($skillsData)) {
                    $skillsData = json_decode($skillsData, true);
                }
                if (is_array($skillsData)) {
                    // Skills are synced via relationship, not stored in candidates table
                    $this->syncCandidateSkills($user->candidate, $skillsData);
                    $skillsUpdated = true;
                }
            }

            // Education fields
            if ($request->has('university')) {
                $updateData['university'] = $request->input('university');
            }

            if ($request->hasAny(['university', 'diploma', 'diploma_level', 'start_year', 'end_year', 'education_id'])) {
                $this->syncCandidateEducation($request, $user->candidate);
                $educationUpdated = true;
            }

            if (!empty($updateData) || $skillsUpdated || $educationUpdated) {
                if (!empty($updateData)) {
                    $user->candidate->update($updateData);
                }

                // Notify active companies when candidate profile gets updated.
                $this->companyRealtimeNotificationService->notifyCandidateProfileUpdated($user->candidate);

                // Invalidate cache
                $this->authService->invalidateProfileCache($user->id);

                return response()->json([
                    'success' => true,
                    'message' => 'Profile updated successfully',
                ]);
            }
        } else {
            // Check if they are trying to update candidate-only fields
            $candidateFields = ['skills', 'university', 'diploma', 'diploma_level', 'start_year', 'end_year'];
            foreach ($candidateFields as $field) {
                if ($request->has($field)) {
                    return response()->json([
                        'success' => false,
                        'message' => "Accès refusé. Seuls les candidats peuvent avoir des compétences ou une formation."
                    ], 403);
                }
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Nothing to update or invalid data',
        ], 400);
    }

    public function syncCandidateEducation(Request $request, Candidate $candidate)
    {
        if (!Schema::hasTable('candidate_educations')) {
            return;
        }

        $educationId = $request->input('education_id');
        $universityName = trim((string) $request->input('university', ''));
        $diplomaName = trim((string) $request->input('diploma', ''));
        $diplomaLevel = $request->input('diploma_level'); 
        $startYear = trim((string) $request->input('start_year', ''));
        $endYear = trim((string) $request->input('end_year', ''));

        $hasEducationData = ($universityName !== '' || $diplomaName !== '' || $startYear !== '' || $endYear !== '');

        // If education_id is provided, we might be trying to update or delete a specific one
        if ($educationId) {
            $edu = $candidate->educations()->find($educationId);
            if ($edu) {
                if (!$hasEducationData) {
                    $edu->delete();
                } else {
                    $edu->update([
                        'university' => $universityName ?: null,
                        'diploma' => $diplomaName ?: null,
                        'level' => $diplomaLevel,
                        'start_date' => preg_match('/^\d{4}$/', $startYear) ? ($startYear . '-01-01') : null,
                        'end_date' => preg_match('/^\d{4}$/', $endYear) ? ($endYear . '-12-31') : null,
                    ]);
                }
                return;
            }
        }

        // Create new if data is provided and no specific ID was found/passed
        if ($hasEducationData) {
            $candidate->educations()->create([
                'university' => $universityName ?: null,
                'diploma' => $diplomaName ?: null,
                'level' => $diplomaLevel,
                'start_date' => preg_match('/^\d{4}$/', $startYear) ? ($startYear . '-01-01') : null,
                'end_date' => preg_match('/^\d{4}$/', $endYear) ? ($endYear . '-12-31') : null,
            ]);
        }
    }

    private function syncCandidateSkills(Candidate $candidate, array $skillsData): void
    {
        if (!Schema::hasTable('candidate_skills') || !Schema::hasTable('skills')) {
            return;
        }

        $syncRows = [];

        foreach ($skillsData as $item) {
            $skillId = null;
            $level = 'intermediate';

            if (is_string($item)) {
                $name = trim($item);
                if ($name === '') {
                    continue;
                }

                $skillId = DB::table('skills')
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                    ->value('id');

                if (!$skillId) {
                    $skillId = DB::table('skills')->insertGetId([
                        'name' => $name,
                    ]);
                }
            } elseif (is_array($item)) {
                if (!empty($item['id'])) {
                    $skillId = (int) $item['id'];
                } elseif (!empty($item['name'])) {
                    $name = trim((string) $item['name']);
                    if ($name !== '') {
                        $skillId = DB::table('skills')
                            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                            ->value('id');

                        if (!$skillId) {
                            $skillId = DB::table('skills')->insertGetId([
                                'name' => $name,
                            ]);
                        }
                    }
                }

                $level = $this->normalizeSkillLevel($item['level'] ?? null);
            }

            if (!$skillId) {
                continue;
            }

            $syncRows[$skillId] = [
                'candidate_id' => $candidate->id,
                'skill_id' => $skillId,
                'level' => $level,
                'updated_at' => now(),
            ];
        }

        $skillIds = array_keys($syncRows);

        if (empty($skillIds)) {
            DB::table('candidate_skills')
                ->where('candidate_id', $candidate->id)
                ->delete();
            return;
        }

        DB::table('candidate_skills')
            ->where('candidate_id', $candidate->id)
            ->whereNotIn('skill_id', $skillIds)
            ->delete();

        foreach ($syncRows as $row) {
            DB::table('candidate_skills')->updateOrInsert(
                [
                    'candidate_id' => $candidate->id,
                    'skill_id' => $row['skill_id'],
                ],
                [
                    'level' => $row['level'],
                    'updated_at' => $row['updated_at'],
                ]
            );
        }
    }

    private function normalizeSkillLevel(mixed $value): string
    {
        $level = mb_strtolower(trim((string) $value));
        if (in_array($level, ['beginner', 'intermediate', 'advanced'], true)) {
            return $level;
        }
        return 'intermediate';
    }

    private function normalizeDiplomaLevel(mixed $value): ?int
    {
        $level = mb_strtolower(trim((string) $value));
        return match ($level) {
            'licence', 'license' => 1,
            'master' => 2,
            'cycle_ing', 'cycle ing', 'cycleing', 'ing' => 3,
            default => null,
        };
    }
    public function updateBasicInfo(Request $request)
    {
        $user = Auth::user();

        $request->validate([
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|regex:/^[2-9]\d{7}$/|max:20',
            'location' => 'sometimes|string|max:255',
            'bio' => 'sometimes|string|max:2000',
            'hr_name' => 'sometimes|string|max:255',
        ]);

        // 1. Update User Email
        if ($request->has('email')) {
            $user->update(['email' => $request->input('email')]);
        }

        // 2. Update Profile Data
        $profileData = [];
        if ($request->has('phone'))
            $profileData['phone'] = $request->input('phone');
        if ($request->has('location'))
            $profileData['location'] = $request->input('location');
        if ($request->has('bio'))
            $profileData['bio'] = $request->input('bio');

        if ($user->isCandidate()) {
            if ($request->has('name')) {
                $parts = explode(' ', trim($request->input('name')), 2);
                $profileData['first_name'] = $parts[0];
                $profileData['last_name'] = $parts[1] ?? '';
            }
            $user->candidate->update($profileData);
        } elseif ($user->isCompanyAdmin()) {
            // Update Company Brand Info if needed
            if ($request->has('name')) {
                $user->company->update(['name' => $request->input('name')]);
            }
            if ($request->has('location')) {
                $user->company->update(['location' => $request->input('location')]);
            }
            if ($request->has('bio')) {
                $user->company->update(['description' => $request->input('bio')]);
            }
 
            // Update HR Manager Personal Info
            $hrData = [];
            if ($request->has('hr_name') || $request->has('name')) {
                $hrData['full_name'] = $request->input('hr_name') ?? $request->input('name');
            }
            if ($request->has('phone')) {
                $hrData['phone'] = $request->input('phone');
            }

            if (!empty($hrData)) {
                \App\Models\Hr::updateOrCreate(
                    ['user_id' => $user->id],
                    array_merge($hrData, ['company_id' => $user->company->id])
                );
            }
        } elseif ($user->isRecruiter() && $user->recruiter) {
            if ($request->has('name')) {
                $profileData['full_name'] = $request->input('name');
            }
            if (!empty($profileData)) {
                $user->recruiter->update($profileData);
            }
        }

        $this->authService->invalidateProfileCache($user->id);

        return response()->json([
            'success' => true,
            'message' => 'Informations mises à jour avec succès',
        ]);
    }
}
