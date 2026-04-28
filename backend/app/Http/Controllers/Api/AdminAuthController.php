<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\KeycloakService;
use Illuminate\Http\Request;
use App\Models\FcmToken;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class AdminAuthController extends Controller
{
    protected KeycloakService $keycloakService;

    public function __construct(KeycloakService $keycloakService)
    {
        $this->keycloakService = $keycloakService;
    }
    /**
     * Admin login via Keycloak
     */
    public function login(Request $request)
    {
        Log::info('Login attempt for admin: ' . $request->email);

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        // 1. Try to authenticate as a project admin (recrutement realm)
        $result = $this->keycloakService->authenticate(
            $request->email,
            $request->password
        );

        if ($result) {
            Log::info('Authentication successful for realm recrutement');
        } else {
            Log::info('Authentication failed for realm recrutement, trying master realm...');
            $result = $this->keycloakService->authenticateAdmin(
                $request->email,
                $request->password
            );
        }

        if (!$result) {
            Log::warning('Authentication failed for both realms for: ' . $request->email);
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        // Verify Roles
        $isAdmin = false;
        $normalizedRole = null;
        if (isset($result['user'])) {
            $normalizedRole = strtolower((string) $result['user']->role);
            $isAdmin = in_array($normalizedRole, ['admin', 'superadmin'], true);
        } elseif (isset($result['user_info']['roles'])) {
            $roles = array_map('strtolower', $result['user_info']['roles']);
            $isAdmin = in_array('admin', $roles, true) || in_array('superadmin', $roles, true);
        }

        if (!$isAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. You do not have administrator privileges.'
            ], 403);
        }

        $adminData = [];
        if (isset($result['user'])) {
            $adminData = [
                'id' => $result['user']->id,
                'email' => $result['user']->email,
                'full_name' => $result['user']->email, // Use email as name if profile not found
                'role' => 'ADMIN',
                'roles' => [$normalizedRole ?? 'admin']
            ];
        } else {
            $adminData = [
                'id' => $result['user_info']['sub'],
                'email' => $result['user_info']['email'],
                'full_name' => $result['user_info']['full_name'],
                'role' => 'ADMIN',
                'roles' => $result['user_info']['roles'],
            ];
        }

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'token' => $result['access_token'],
                'token_type' => 'bearer',
                'expires_in' => $result['expires_in'],
                'refresh_token' => $result['refresh_token'],
                'admin' => $adminData
            ]
        ], 200);
    }

    /**
     * Get authenticated admin details
     */
    public function me(Request $request)
    {
        try {
            $token = str_replace('Bearer ', '', $request->header('Authorization'));

            // Try local extraction first to avoid 401 on userinfo if token is misconfigured
            $tokenData = $this->keycloakService->extractTokenPayload($token);
            $userInfo = null;

            if ($tokenData && (isset($tokenData['email']) || isset($tokenData['preferred_username']))) {
                $userInfo = [
                    'sub' => $tokenData['sub'] ?? null,
                    'email' => $tokenData['email'] ?? $tokenData['preferred_username'] ?? null,
                    'name' => $tokenData['name'] ?? $tokenData['preferred_username'] ?? null,
                    'preferred_username' => $tokenData['preferred_username'] ?? null,
                ];
            } else {
                // Fallback to network call
                $userInfo = $this->keycloakService->getUserInfo($token);
            }

            if (!$userInfo) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            // Cache key based on user ID
            $cacheKey = 'admin_profile_' . ($userInfo['sub'] ?? 'unknown');

            // Try to get from cache first (cache for 60 minutes)
            $response = \Illuminate\Support\Facades\Cache::remember($cacheKey, 60 * 60, function () use ($userInfo) {
                return [
                    'id' => $userInfo['sub'] ?? null,
                    'email' => $userInfo['email'] ?? null,
                    'full_name' => $userInfo['name'] ?? null,
                    'role' => 'ADMIN',
                    'preferred_username' => $userInfo['preferred_username'] ?? null,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $response
            ], 200);
        } catch (\Exception $e) {
            Log::error('Admin me error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }
    }

    /**
     * Admin logout
     */
    public function logout(Request $request)
    {
        try {
            $refreshToken = $request->input('refresh_token');

            if ($refreshToken) {
                $this->keycloakService->logout($refreshToken);
            }

            // Clear cache - extract SUB from token locally
            $token = str_replace('Bearer ', '', $request->header('Authorization'));
            $tokenData = $this->keycloakService->extractTokenPayload($token);

            if ($tokenData && isset($tokenData['sub'])) {
                \Illuminate\Support\Facades\Cache::forget('admin_profile_' . $tokenData['sub']);
            }

            return response()->json([
                'success' => true,
                'message' => 'Successfully logged out'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to logout'
            ], 500);
        }
    }

    /**
     * Refresh Keycloak token
     */
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
                'data' => [
                    'token' => $result['access_token'],
                    'token_type' => 'bearer',
                    'expires_in' => $result['expires_in'] ?? 7200,
                    'refresh_token' => $result['refresh_token'] ?? $refreshToken,
                ]
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token refresh failed'
            ], 401);
        }
    }

    /**
     * Update Admin's FCM token for push notifications
     */
    public function updateFcmToken(Request $request)
    {
        $request->validate([
            'fcm_token' => 'required|string',
            'platform' => 'nullable|string|max:50',
        ]);

        try {
            $token = str_replace('Bearer ', '', $request->header('Authorization'));
            $tokenData = $this->keycloakService->extractTokenPayload($token);
            $email = null;

            if ($tokenData && (isset($tokenData['email']) || isset($tokenData['preferred_username']))) {
                $email = $tokenData['email'] ?? $tokenData['preferred_username'] ?? null;
            } else {
                $userInfo = $this->keycloakService->getUserInfo($token);
                $email = $userInfo['email'] ?? $userInfo['preferred_username'] ?? null;
            }

            if (!$email) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
            }

            // Find or create user in local DB to store the token
            $user = \App\Models\User::updateOrCreate(
                ['email' => $email],
                [
                    'role' => 'ADMIN',
                    'is_active' => true,
                    'fcm_token' => $request->fcm_token
                ]
            );

            $platform = strtolower($request->input('platform', 'unknown'));
            FcmToken::updateOrCreate(
                ['token' => $request->fcm_token],
                [
                    'user_id' => $user->id,
                    'platform' => $platform,
                    'last_seen_at' => now(),
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'FCM token updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update FCM token',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
