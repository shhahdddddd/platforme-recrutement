<?php

namespace App\Services;

use App\Models\User;
use App\Models\Candidate;
use App\Models\Company;

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Mail\OtpMail;
use App\Mail\PasswordChangedMail;
use Illuminate\Support\Facades\Mail;
use Exception;
use App\Services\KeycloakService;

class AuthService
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }

    /**
     * Send OTP to email
     */
    public function sendOtp(string $email): void
    {
        $email = strtolower(trim($email));
        $otp = rand(100000, 999999);


        try {
            Cache::put("otp_$email", $otp, now()->addMinutes(10));
            Log::info("OTP cached for $email", ['otp_length' => strlen((string)$otp)]);
        } catch (\Throwable $e) {
            Log::error("OTP cache store failed (is Redis running?)", [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);
            throw new Exception('OTP service temporarily unavailable. Please try again later.', 503);
        }


        try {
            Mail::to($email)->send(new OtpMail($otp));
        } catch (\Throwable $e) {
            Log::error("Failed to send OTP email", [
                'email' => $email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw new Exception('Failed to send OTP: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Verify OTP
     */
    public function verifyOtp(string $email, string $otp): bool
    {
        $email = strtolower(trim($email));
        try {
            $cachedOtp = Cache::get("otp_$email");
        } catch (\Throwable $e) {
            Log::error("OTP cache read failed (is Redis running?)", [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);
            return false;
        }

        Log::info("Verifying OTP for $email. Provided: $otp, Cached: " . ($cachedOtp ?? 'NULL'));

        if ($cachedOtp && $cachedOtp == $otp) {
            try {
                Cache::forget("otp_$email"); // Clean up after successful verification
            } catch (\Throwable $e) {
                Log::warning("OTP cache forget failed", [
                    'email' => $email,
                    'error' => $e->getMessage(),
                ]);
            }
            Log::info("OTP verified successfully for $email");
            return true;
        }

        Log::warning("OTP verification failed for $email");
        return false;
    }
    /**
     * Register a new user (Keycloak handles authentication)
     */
    public function registerUser(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'email' => $data['email'],
                'password_hash' => Hash::make($data['password']),
                'role' => $data['role'],
            ]);

            Log::info("User created successfully: " . $user->id);

            $this->createRoleProfile($user, $data);

            return $user;
        });
    }

    /**
     * Login user with password (Keycloak handles token generation)
     */
    public function login(string $email, string $password): User
    {
        Log::info("Login attempt for email: $email");
        Log::info("Received password length: " . strlen($password));

        $user = User::whereRaw('LOWER(email) = ?', [strtolower(trim($email))])->first();

        if (!$user) {
            Log::warning("Login failed: User not found for email: $email");
            throw new Exception('Invalid credentials', 401);
        }

        Log::info("User found: {$user->id}, checking password hash for role: {$user->role}");

        if (!Hash::check($password, $user->password_hash)) {
            Log::warning("Login failed: Password mismatch for user {$user->id}");
            throw new Exception('Invalid credentials', 401);
        }

        Log::info("Password verified. Checking if user {$user->id} is active...");

        if (!$user->is_active && !$user->isCompanyAdmin()) {
            Log::warning("Login blocked for deactivated user {$user->id}");
            throw new Exception('Votre compte a été désactivé. Contactez l\'assistance si vous pensez que c\'est une erreur.', 403);
        }

        if (!$user->is_active && $user->isCompanyAdmin()) {
            Log::info("Company user {$user->id} is soft-deactivated: login allowed, posting remains restricted.");
        }

        $user->update(['last_login' => now()]);

        return $user;
    }

    private function createRoleProfile(User $user, array $data): void
    {
        try {
            switch ($user->role) {
                case 'candidate':
                    $specialtyId = null;
                    if (!empty($data['specialite'])) {
                        try {
                            $specialty = \App\Models\Specialty::firstOrCreate(['name' => $data['specialite']]);
                            $specialtyId = $specialty->id;
                        } catch (\Exception $e) {
                            Log::warning("Could not create specialty: " . $e->getMessage());
                        }
                    }

                    \App\Models\Candidate::create([
                        'user_id' => $user->id,
                        'first_name' => $data['first_name'] ?? $user->email,
                        'last_name' => $data['last_name'] ?? '',
                        'phone' => $data['phone'] ?? null,
                        'location' => $data['location'] ?? null,
                        'specialty_id' => $specialtyId,
                        'still_student' => (bool) ($data['still_student'] ?? false),
                        'cycle_eng' => (bool) ($data['is_engineer'] ?? false),
                        'bio' => $data['bio'] ?? null,
                        'picture' => $data['photo_path'] ?? null,
                    ]);
                    break;

                case 'COMPANY':
                case 'company':
                    $industryId = null;
                    if (!empty($data['industry'])) {
                        try {
                            $industry = \App\Models\Industry::firstOrCreate(['name' => $data['industry']]);
                            $industryId = $industry->id;
                        } catch (\Exception $e) {
                            Log::warning("Could not create industry: " . $e->getMessage());
                        }
                    }

                    $company = \App\Models\Company::create([
                        'user_id' => $user->id,
                        'name' => $data['company_name'] ?? $user->email,
                        'description' => $data['description'] ?? null,
                        'industry_id' => $industryId,
                        'location' => $data['location'] ?? null,
                        'international' => (bool) ($data['international'] ?? false),
                        'picture' => $data['photo_path'] ?? null,
                    ]);

                    // Create the Master HR profile for this company admin
                    \App\Models\Hr::create([
                        'user_id' => $user->id,
                        'company_id' => $company->id,
                        'full_name' => $data['hr_name'] ?? ($data['first_name'] ?? 'HR Manager'),
                        'phone' => $data['phone'] ?? null,
                        'picture' => $data['photo_path'] ?? null,
                    ]);
                    break;
            }
        } catch (\Exception $e) {
            Log::error("Failed to create role profile for user {$user->id}: " . $e->getMessage());
            throw $e; // Re-throw to ensure transaction rollback
        }
    }

    /**
     * Get user profile details with Redis caching
     */
    public function getProfile(User $user)
    {
        $cacheKey = "user_profile_{$user->id}";

        $resolver = function () use ($user) {
            // Re-fetch the user from DB to ensure we have the latest related profile
            $freshUser = $user->fresh();
            if (!$freshUser) {
                return null;
            }

            if ($freshUser->isCandidate()) {
                // Candidate relation may be missing for freshly migrated users.
                $candidateProfile = $freshUser->candidate;
                return $candidateProfile ? $candidateProfile->load('educations') : null;
            }

            if ($freshUser->isCompanyAdmin()) {
                // Returns HR profile loaded with Company info
                return $freshUser->hr ? $freshUser->hr->load('company') : $freshUser->company;
            }

            if ($freshUser->isRecruiter()) {
                return $freshUser->recruiter ? $freshUser->recruiter->load(['department', 'company']) : null;
            }


            return null;
        };

        // Redis might be down in dev; never crash login because cache is unavailable.
        try {
            return Cache::remember($cacheKey, 3600, function () use ($user, $resolver) {
                Log::info("Caching profile for user {$user->id}");
                return $resolver();
            });
        } catch (\Throwable $e) {
            Log::warning('Profile cache unavailable, falling back to direct DB read', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return $resolver();
        }
    }

    /**
     * Update user password
     */
    public function updatePassword(User $user, string $currentPassword, string $newPassword): void
    {
        // Try to verify current password against Keycloak
        $authResult = $this->keycloakService->authenticate($user->email, $currentPassword);

        // If Keycloak auth fails, fall back to check local hash (for non-Keycloak users or legacy)
        if (!$authResult && !Hash::check($currentPassword, $user->password_hash)) {
            throw new Exception('Le mot de passe actuel est incorrect.', 422);
        }

        // Update Keycloak password
        $this->keycloakService->updateKeycloakPassword($user->email, $newPassword);

        // Update local hash for sync
        $user->update([
            'password_hash' => Hash::make($newPassword)
        ]);

        Log::info("Password updated for user in Keycloak and DB: " . $user->id);

        // Send security email notification for all password changes
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
        }
    }

    /**
     * Reset user password (Direct - Insecure if no OTP, but requested)
     */
    public function resetPassword(string $email, string $newPassword): void
    {
        $normalizedEmail = strtolower(trim($email));
        $user = User::whereRaw('LOWER(email) = ?', [$normalizedEmail])->first();

        if (!$user) {
            throw new Exception('Utilisateur non trouvé avec cet email.', 404);
        }

        // Update Keycloak password if possible
        $this->keycloakService->updateKeycloakPassword($normalizedEmail, $newPassword);

        $user->update([
            'password_hash' => Hash::make($newPassword)
        ]);

        Log::info("Password reset manually for user (Keycloak + local): " . $user->id);

        // Send security email notification after reset
        try {
            Mail::to($user->email)->send(new PasswordChangedMail($user));
            Log::info("Password reset security notification sent to user: {$user->id} ({$user->email})");
        } catch (\Throwable $e) {
            Log::error("CRITICAL: Failed to send password changed notification after reset", [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Invalidate cached profile
     */
    public function invalidateProfileCache(int $userId): void
    {
        try {
            Cache::forget("user_profile_{$userId}");
        } catch (\Throwable $e) {
            Log::warning('Failed to invalidate profile cache', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Deactivate user account (soft deactivation)
     */
    public function deactivateAccount(User $user): void
    {
        Log::info("Deactivating account for user {$user->id}, current is_active: " . ($user->is_active ? 'true' : 'false'));

        $user->update(['is_active' => false]);

        // Refresh the model to confirm the update
        $user->refresh();
        Log::info("After update, user {$user->id} is_active: " . ($user->is_active ? 'true' : 'false'));

        // Invalidate all tokens for this user
        try {
            Cache::forget("user_profile_{$user->id}");
        } catch (\Throwable $e) {
            Log::warning('Failed to forget profile cache on deactivation', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        Log::info("User account deactivated: " . $user->id);
    }
}
