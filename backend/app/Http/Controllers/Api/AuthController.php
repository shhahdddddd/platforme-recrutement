<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\KeycloakService;
use App\Services\AuthService;
use App\Models\FcmToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Exception;

class AuthController extends Controller
{
    protected KeycloakService $keycloakService;
    protected AuthService $authService;

    public function __construct(KeycloakService $keycloakService, AuthService $authService)
    {
        $this->keycloakService = $keycloakService;
        $this->authService = $authService;
    }

    public function register(RegisterRequest $request)
    {
        try {
            $user = $this->keycloakService->createUser($request->validated());

            if ($user) {
                try {
                    event(new \Illuminate\Auth\Events\Registered($user));
                } catch (\Throwable $e) {
                    \Log::warning('Registration event failed, continuing without email verification', [
                        'email' => $user->email ?? null,
                        'error' => $e->getMessage(),
                    ]);
                }
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Registration failed'
                ], 500);
            }

            try {
                $profile = $this->authService->getProfile($user);
            } catch (\Throwable $e) {
                \Log::warning('Profile load failed after registration', [
                    'email' => $user->email ?? null,
                    'error' => $e->getMessage(),
                ]);
                $profile = null;
            }

            return response()->json([
                'success' => true,
                'message' => 'Registration successful. Please check your email for verification link.',
                'data' => new UserResource($user, null, $profile)
            ], 201);

        } catch (Exception $e) {
            \Log::error('Registration failed', [
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->errorResponse('Registration failed', $e);
        }
    }

    public function checkEmail(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $email = strtolower(trim((string) $request->email));
        $exists = \App\Models\User::whereRaw('LOWER(email) = ?', [$email])->exists();
        return response()->json([
            'success' => true,
            'exists' => $exists
        ]);
    }

    public function sendOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        try {
            $this->authService->sendOtp($request->email);

            $response = [
                'success' => true,
                'message' => 'OTP sent successfully'
            ];

            if (config('app.debug') && (env('DEV_RETURN_OTP') === true || env('DEV_RETURN_OTP') === 'true')) {
                try {
                    $response['otp'] = (string) \Illuminate\Support\Facades\Cache::get("otp_" . $request->email);
                } catch (\Throwable $e) {
                    // Cache may be unavailable (Redis down). Don't fail OTP send response because of debug helper.
                }
            }

            return response()->json($response);
        } catch (Exception $e) {
            return $this->errorResponse('Failed to send OTP', $e);
        }
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string|size:6'
        ]);

        $isValid = $this->authService->verifyOtp($request->email, $request->otp);

        if ($isValid) {
            $normalizedEmail = strtolower(trim((string) $request->email));

            // Mark email as verified in the database
            $user = User::whereRaw('LOWER(email) = ?', [$normalizedEmail])
                ->orderByDesc('id')
                ->first();
            if ($user && !$user->hasVerifiedEmail()) {
                $user->markEmailAsVerified();
            }

            // Legacy cleanup: if case-variant duplicates exist, mark them verified too.
            User::whereRaw('LOWER(email) = ?', [$normalizedEmail])
                ->whereNull('email_verified_at')
                ->update(['email_verified_at' => now()]);

            return response()->json([
                'success' => true,
                'message' => 'OTP verified successfully'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Invalid or expired OTP'
        ], 422);
    }


    public function login(LoginRequest $request)
    {
        try {
            // Check if user exists locally first to provide better error message
            $email = strtolower(trim((string) $request->email));
            $user = User::whereRaw('LOWER(email) = ?', [$email])
                ->orderByRaw('CASE WHEN email_verified_at IS NULL THEN 1 ELSE 0 END')
                ->orderByDesc('email_verified_at')
                ->orderByDesc('id')
                ->first();
            
            if (!$user) {
                \Log::info('Login attempt for non-existent user: ' . $email);
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Check email verification
            if (!$user->hasVerifiedEmail()) {
                $resent = false;
                try {
                    $user->sendEmailVerificationNotification();
                    $resent = true;
                } catch (\Throwable $e) {
                    \Log::warning('Failed to resend verification link during login', [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'error' => $e->getMessage(),
                    ]);
                }

                return response()->json([
                    'success' => false,
                    'message' => $resent
                        ? 'Your email address is not verified. A new verification link has been sent to your inbox.'
                        : 'Your email address is not verified. Please check your inbox for the verification link.',
                    'needs_verification' => true,
                    'verification_resent' => $resent,
                ], 403);
            }

            // Block deactivated accounts from obtaining new access tokens.
            // Company admins are an exception in this app (soft-deactivated accounts may still sign in).
            if (!$user->is_active && !$user->isCompanyAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your account is deactivated. Please contact support.'
                ], 403);
            }

            $result = $this->keycloakService->authenticate($request->email, $request->password);

            if (
                !$result &&
                !empty($user->password_hash) &&
                Hash::check($request->password, $user->password_hash)
            ) {
                $normalizedRole = strtolower((string) $user->role);
                $keycloakRole = match ($normalizedRole) {
                    'candidate', 'candidat' => 'candidate',
                    'company', 'entreprise' => 'company',
                    'recruiter', 'recruteur' => 'recruiter',
                    'admin' => 'admin',
                    default => 'candidate',
                };

                \Log::warning('Keycloak login failed but local password matched. Attempting Keycloak sync + retry.', [
                    'email' => $user->email,
                    'role' => $user->role,
                    'mapped_role' => $keycloakRole,
                ]);

                $syncedUserId = $this->keycloakService->createKeycloakUser([
                    'email' => $user->email,
                    'password' => $request->password,
                    'role' => $keycloakRole,
                ]);

                if ($syncedUserId) {
                    $result = $this->keycloakService->authenticate($request->email, $request->password);
                }
            }

            if (!$result) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid credentials'
                ], 401);
            }

            $profile = $this->authService->getProfile($result['user']);

            return response()->json([
                'success' => true,
                'message' => 'Login successful',
                'data' => [
                    'user' => new UserResource($result['user'], null, $profile),
                    'access_token' => $result['access_token'],
                    'refresh_token' => $result['refresh_token'],
                    'expires_in' => $result['expires_in'],
                    'token_type' => 'Bearer',
                ]
            ], 200);

        } catch (Exception $e) {
            return $this->errorResponse($e->getMessage(), $e, $e->getCode() ?: 401);
        }
    }
    public function logout(Request $request)
    {
        try {
            $refreshToken = $request->input('refresh_token');

            if ($refreshToken) {
                $this->keycloakService->logout($refreshToken);
            }

            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully'
            ], 200);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Logout failed',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
            'password' => 'required|min:8|confirmed',
        ]);

        try {
            $this->authService->resetPassword(
                $request->email,
                $request->password
            );

            return response()->json([
                'success' => true,
                'message' => 'Mot de passe réinitialisé avec succès.'
            ]);

        } catch (Exception $e) {
            return $this->errorResponse($e->getMessage(), $e, $e->getCode() ?: 400);
        }
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|min:8|confirmed',
        ]);

        try {
            $this->authService->updatePassword(
                $request->user(),
                $request->current_password,
                $request->new_password
            );

            return response()->json([
                'success' => true,
                'message' => 'Mot de passe mis à jour avec succès.'
            ]);

        } catch (Exception $e) {
            return $this->errorResponse($e->getMessage(), $e, $e->getCode() ?: 400);
        }
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $profile = $this->authService->getProfile($user);

        return response()->json([
            'success' => true,
            'data' => new UserResource($user, null, $profile)
        ], 200);
    }



    public function refresh(Request $request)
    {
        try {
            $refreshToken = $request->input('refresh_token');

            if (!$refreshToken) {
                return response()->json([
                    'success' => false,
                    'message' => 'Refresh token required'
                ], 400);
            }

            $result = $this->keycloakService->refreshToken($refreshToken);

            if (!$result) {
                return response()->json([
                    'success' => false,
                    'message' => 'Token refresh failed'
                ], 401);
            }

            return response()->json([
                'success' => true,
                'message' => 'Token refreshed',
                'data' => [
                    'access_token' => $result['access_token'],
                    'refresh_token' => $result['refresh_token'] ?? $refreshToken,
                    'expires_in' => $result['expires_in'] ?? 7200,
                    'token_type' => 'Bearer',
                ]
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token refresh failed'
            ], 401);
        }
    }

    public function deactivateAccount(Request $request)
    {
        try {
            $user = $request->user();
            $this->authService->deactivateAccount($user);

            return response()->json([
                'success' => true,
                'message' => 'Ton compte a été désactivé avec succès.'
            ], 200);

        } catch (Exception $e) {
            return $this->errorResponse('Échec de la désactivation du compte', $e);
        }
    }

    public function updateFcmToken(Request $request)
    {
        $request->validate([
            'fcm_token' => 'required|string',
            'platform' => 'nullable|string|max:50',
        ]);

        try {
            $user = $request->user();
            $platform = strtolower($request->input('platform', 'unknown'));

            FcmToken::updateOrCreate(
                ['token' => $request->fcm_token],
                [
                    'user_id' => $user->id,
                    'platform' => $platform,
                    'last_seen_at' => now(),
                ]
            );

            // Keep the latest token on the user record for backward compatibility.
            $user->update(['fcm_token' => $request->fcm_token]);

            return response()->json([
                'success' => true,
                'message' => 'FCM token updated successfully'
            ]);
        } catch (Exception $e) {
            return $this->errorResponse('Failed to update FCM token', $e);
        }
    }

    private function errorResponse(string $message, Exception $e, int $status = 500)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'error' => config('app.debug') ? $e->getMessage() : null
        ], $status == 0 ? 500 : $status);
    }
}
