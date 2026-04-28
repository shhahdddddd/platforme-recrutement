<?php

namespace App\Services;

use App\Models\User;
use App\Models\Candidate;
use App\Models\Company;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class KeycloakService
{
    protected Client $httpClient;
    protected string $serverUrl;
    protected string $realm;
    protected string $clientId;
    protected string $clientSecret;
    protected string $adminRealm;
    protected string $adminClientId;
    protected string $adminUsername;
    protected string $adminPassword;

    public function __construct()
    {
        $this->serverUrl = $this->resolveServerUrl(config('keycloak.server_url'));
        $this->realm = config('keycloak.realm');
        $this->clientId = config('keycloak.client_id');
        $this->clientSecret = config('keycloak.client_secret');
        $this->adminRealm = config('keycloak.admin_realm', 'master');
        $this->adminClientId = config('keycloak.admin_client_id', 'admin-cli');
        $this->adminUsername = config('keycloak.admin_username', 'admin');
        $this->adminPassword = config('keycloak.admin_password');

        $this->httpClient = new Client([
            'base_uri' => $this->serverUrl,
            'timeout' => 10,
            'connect_timeout' => 3,
            'read_timeout' => 10,
            'verify' => false, // Set to true in production with valid SSL
        ]);
    }

    /**
     * Authenticate user with Keycloak using username/password
     */
    public function authenticate(string $username, string $password): ?array
    {
        try {
            // Force lowercase username if it's an email
            $username = strtolower(trim($username));

            Log::info('Attempting Keycloak authentication', [
                'username' => $username,
                'realm' => $this->realm,
                'client_id' => $this->clientId
            ]);

            $data = $this->requestPasswordGrantToken($username, $password);

            if (isset($data['access_token'])) {
                Log::info('Keycloak authentication successful', ['username' => $username]);

                // Decode token to get user info
                $tokenData = $this->decodeToken($data['access_token']);

                // Sync user with local database
                $user = $this->syncUserFromToken($tokenData);

                return [
                    'user' => $user,
                    'access_token' => $data['access_token'],
                    'refresh_token' => $data['refresh_token'] ?? null,
                    'expires_in' => $data['expires_in'] ?? 7200,
                ];
            }

            Log::warning('Keycloak authentication returned no access token', ['username' => $username]);
            return null;
        } catch (\GuzzleHttp\Exception\ClientException $e) {
            $response = $e->getResponse();
            $statusCode = $response ? $response->getStatusCode() : 0;
            $body = $response ? $response->getBody()->getContents() : '';

            Log::error('Keycloak authentication failed (ClientException)', [
                'username' => $username,
                'status_code' => $statusCode,
                'error' => $e->getMessage(),
                'response_body' => $body
            ]);

            $normalizedBody = strtolower((string) $body);
            $isIncompleteAccount = $statusCode === 400 && str_contains($normalizedBody, 'account is not fully set up');

            // Some recruiter accounts are created before full Keycloak setup completes.
            // Auto-repair and retry once to avoid hard login failure for valid credentials.
            if ($isIncompleteAccount) {
                Log::warning('Keycloak account is not fully set up. Attempting auto-fix and retry.', [
                    'username' => $username,
                ]);

                $fixed = $this->fixUserByEmail($username);
                if ($fixed) {
                    try {
                        $retryData = $this->requestPasswordGrantToken($username, $password);
                        if (isset($retryData['access_token'])) {
                            Log::info('Keycloak authentication successful after auto-fix', ['username' => $username]);

                            $tokenData = $this->decodeToken($retryData['access_token']);
                            $user = $this->syncUserFromToken($tokenData);

                            return [
                                'user' => $user,
                                'access_token' => $retryData['access_token'],
                                'refresh_token' => $retryData['refresh_token'] ?? null,
                                'expires_in' => $retryData['expires_in'] ?? 7200,
                            ];
                        }
                    } catch (\Throwable $retryException) {
                        Log::error('Keycloak authentication retry failed after auto-fix', [
                            'username' => $username,
                            'error' => $retryException->getMessage(),
                        ]);
                    }
                } else {
                    Log::warning('Keycloak auto-fix failed for incomplete account', [
                        'username' => $username,
                    ]);
                }
            }

            if ($statusCode === 400 || $statusCode === 401) {
                return null;
            }

            throw new \RuntimeException('Authentication service unavailable. Please try again in a moment.', 503, $e);
        } catch (\Exception $e) {
            Log::error('Keycloak authentication failed (Exception)', [
                'username' => $username,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            throw new \RuntimeException('Authentication service unavailable. Please check Keycloak connectivity.', 503, $e);
        }
    }

    protected function requestPasswordGrantToken(string $username, string $password): array
    {
        $response = $this->httpClient->post("/realms/{$this->realm}/protocol/openid-connect/token", [
            'form_params' => [
                'grant_type' => 'password',
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'username' => $username,
                'password' => $password,
                'scope' => 'openid profile email',
            ],
        ]);

        return json_decode($response->getBody()->getContents(), true) ?? [];
    }

    /**
     * Resolve Keycloak base URL for host and Docker contexts.
     * If "keycloak" hostname is not resolvable (common on host machine), fallback to 127.0.0.1.
     */
    protected function resolveServerUrl(?string $configuredUrl): string
    {
        $url = trim((string) ($configuredUrl ?: 'http://localhost:8080'));
        $parts = parse_url($url);
        $host = $parts['host'] ?? null;

        if (!$host || strtolower($host) !== 'keycloak') {
            return $url;
        }

        $resolved = @gethostbyname($host);
        $isResolvable = $resolved && strtolower($resolved) !== strtolower($host);
        if ($isResolvable) {
            return $url;
        }

        $scheme = $parts['scheme'] ?? 'http';
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';
        $path = $parts['path'] ?? '';
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';
        $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';

        $fallback = "{$scheme}://127.0.0.1{$port}{$path}{$query}{$fragment}";

        Log::warning('Keycloak hostname "keycloak" is not resolvable; falling back to localhost URL', [
            'configured_url' => $url,
            'fallback_url' => $fallback,
        ]);

        return $fallback;
    }

    /**
     * Authenticate admin user
     */
    public function authenticateAdmin(string $username, string $password): ?array
    {
        try {
            $response = $this->httpClient->post("/realms/{$this->adminRealm}/protocol/openid-connect/token", [
                'form_params' => [
                    'grant_type' => 'password',
                    'client_id' => $this->adminClientId,
                    'username' => $username,
                    'password' => $password,
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            if (isset($data['access_token'])) {
                // Check if user has admin role
                $tokenData = $this->decodeToken($data['access_token']);

                $roles = $tokenData['realm_access']['roles'] ?? [];
                $clientRoles = $tokenData['resource_access'][$this->clientId]['roles'] ?? [];
                $allRoles = array_merge($roles, $clientRoles);

                if (!in_array('admin', $allRoles)) {
                    Log::warning('Non-admin user attempted admin login: ' . $username);
                    return null;
                }

                return [
                    'access_token' => $data['access_token'],
                    'refresh_token' => $data['refresh_token'] ?? null,
                    'expires_in' => $data['expires_in'] ?? 7200,
                    'user_info' => [
                        'sub' => $tokenData['sub'] ?? null,
                        'email' => $tokenData['email'] ?? $username,
                        'preferred_username' => $tokenData['preferred_username'] ?? $username,
                        'full_name' => $tokenData['name'] ?? null,
                        'roles' => $allRoles,
                    ],
                ];
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Keycloak admin authentication failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Refresh access token
     */
    public function refreshToken(string $refreshToken): ?array
    {
        try {
            $response = $this->httpClient->post("/realms/{$this->realm}/protocol/openid-connect/token", [
                'form_params' => [
                    'grant_type' => 'refresh_token',
                    'client_id' => $this->clientId,
                    'client_secret' => $this->clientSecret,
                    'refresh_token' => $refreshToken,
                ],
            ]);

            return json_decode($response->getBody()->getContents(), true);
        } catch (\Exception $e) {
            Log::error('Keycloak token refresh failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Logout user (invalidate tokens)
     */
    public function logout(string $refreshToken): bool
    {
        try {
            $this->httpClient->post("/realms/{$this->realm}/protocol/openid-connect/logout", [
                'form_params' => [
                    'client_id' => $this->clientId,
                    'client_secret' => $this->clientSecret,
                    'refresh_token' => $refreshToken,
                ],
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Keycloak logout failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get user info from Keycloak
     */
    public function getUserInfo(string $accessToken): ?array
    {
        try {
            // Try to extract realm from token issuer claim
            $realm = $this->realm;
            $tokenData = $this->extractTokenPayload($accessToken);
            if ($tokenData && isset($tokenData['iss'])) {
                $parts = explode('/realms/', $tokenData['iss']);
                if (count($parts) > 1) {
                    $realm = $parts[1];
                }
            }

            $response = $this->httpClient->get("/realms/{$realm}/protocol/openid-connect/userinfo", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken,
                ],
            ]);

            return json_decode($response->getBody()->getContents(), true);
        } catch (\GuzzleHttp\Exception\ClientException $e) {
            $status = $e->getResponse() ? $e->getResponse()->getStatusCode() : 0;
            if ($status === 401) {
                Log::warning('Keycloak userinfo unauthorized (token expired/invalid)');
            } else {
                Log::error('Keycloak get user info failed: ' . $e->getMessage());
            }
            return null;
        } catch (\Exception $e) {
            Log::error('Keycloak get user info failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Safely extract JWT payload claims without signature verification.
     */
    public function extractTokenPayload(string $token): ?array
    {
        try {
            return $this->decodeToken($token);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Validate a Keycloak access token signature and temporal claims.
     */
    public function validateAccessToken(string $token): ?array
    {
        try {
            $header = $this->decodeJwtSegment($token, 0, 'header');
            $payload = $this->decodeJwtSegment($token, 1, 'payload');

            $expectedAlgorithm = strtoupper((string) config('keycloak.token_algorithm', 'RS256'));
            $algorithm = strtoupper((string) ($header['alg'] ?? ''));
            if ($algorithm !== $expectedAlgorithm) {
                Log::warning('Keycloak token rejected because of unsupported algorithm', [
                    'algorithm' => $algorithm,
                    'expected' => $expectedAlgorithm,
                ]);
                return null;
            }

            $now = time();
            $exp = $payload['exp'] ?? null;
            if (is_numeric($exp) && (int) $exp <= $now) {
                return null;
            }

            $nbf = $payload['nbf'] ?? null;
            if (is_numeric($nbf) && (int) $nbf > $now) {
                return null;
            }

            $realm = $this->resolveRealmFromIssuer($payload['iss'] ?? null) ?? $this->realm;
            $publicKeyPem = $this->getRealmPublicKeyPem($realm);
            if (!$publicKeyPem) {
                Log::warning('Keycloak token rejected because no realm public key was available', [
                    'realm' => $realm,
                ]);
                return null;
            }

            if (!$this->verifyJwtSignature($token, $publicKeyPem, $algorithm)) {
                Log::warning('Keycloak token signature verification failed', [
                    'realm' => $realm,
                ]);
                return null;
            }

            return $payload;
        } catch (\Throwable $e) {
            Log::warning('Keycloak token validation failed', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Resolve a local application user from a validated token payload.
     */
    public function resolveUserFromTokenPayload(array $tokenData): ?User
    {
        $email = strtolower(trim((string) ($tokenData['email'] ?? $tokenData['preferred_username'] ?? '')));
        if ($email === '') {
            return null;
        }

        $user = $this->findLocalUserByEmail($email);
        $tokenRoles = $this->extractRolesFromTokenPayload($tokenData);
        $appRole = $this->mapKeycloakRoleToAppRole($tokenRoles);
        $roleForCreation = $appRole !== '' ? $appRole : 'candidate';

        if (!$user && config('keycloak.create_user_if_not_exists')) {
            $user = User::create([
                'email' => $email,
                'password_hash' => Hash::make(Str::random(32)),
                'role' => strtolower($roleForCreation),
                'is_active' => true,
            ]);
        }

        if (!$user || !$user->is_active) {
            return null;
        }

        // Only sync role when a concrete mapped app role is present.
        // This prevents accidental downgrades (e.g. COMPANY -> candidate)
        // when Keycloak token only has technical/default roles.
        if ($appRole !== '' && strtolower((string) $user->role) !== strtolower($appRole)) {
            $user->forceFill(['role' => strtolower($appRole)])->save();
        }

        return $user;
    }

    /**
     * Create a new user in Keycloak and local database
     */
    public function createUser(array $data): ?User
    {
        $keycloakUserId = null;
        $existingKeycloakUserId = null;
        $adminToken = null;

        try {
            $email = strtolower(trim((string) ($data['email'] ?? '')));
            $data['email'] = $email;
            $data['role'] = strtolower((string) ($data['role'] ?? 'candidate'));

            // Check if the user already exists in Keycloak before creating.
            $adminToken = $this->getAdminAccessToken();
            if ($adminToken && $email !== '') {
                $existing = $this->findKeycloakUserByEmail($email, $adminToken);
                $existingKeycloakUserId = $existing['id'] ?? null;
            }

            // First, create user in Keycloak
            $keycloakUserId = $this->createKeycloakUser($data);

            if (!$keycloakUserId) {
                return null;
            }

            // Create local user + profile in a DB transaction
            return DB::transaction(function () use ($data, $email) {
                $user = $this->findLocalUserByEmail($email);

                if ($user) {
                    $user->forceFill([
                        'email' => $email,
                        'password_hash' => Hash::make($data['password']), // Keep for backup
                        'role' => strtolower((string) $data['role']),
                        'is_active' => true,
                    ])->save();
                } else {
                    $user = User::create([
                        'email' => $email,
                        'password_hash' => Hash::make($data['password']), // Keep for backup
                        'role' => strtolower((string) $data['role']),
                        'is_active' => true,
                    ]);
                }

                // Create role-specific profile
                $this->createRoleProfile($user, $data);

                return $user;
            });
        } catch (\Throwable $e) {
            Log::error('User creation failed: ' . $e->getMessage(), [
                'email' => $data['email'] ?? null,
            ]);

            // If we created a new Keycloak user but local DB failed, clean it up.
            if ($keycloakUserId && (!$existingKeycloakUserId || $existingKeycloakUserId !== $keycloakUserId)) {
                $this->deleteKeycloakUser($keycloakUserId, $adminToken);
            }

            return null;
        }
    }

    /**
     * Delete a Keycloak user (best-effort cleanup).
     */
    protected function deleteKeycloakUser(string $userId, ?string $adminToken = null): void
    {
        try {
            if (!$adminToken) {
                $adminToken = $this->getAdminAccessToken();
            }

            if (!$adminToken) {
                Log::warning("Cannot delete Keycloak user {$userId}: admin token unavailable");
                return;
            }

            $this->httpClient->delete("/admin/realms/{$this->realm}/users/{$userId}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                ],
            ]);

            Log::warning("Deleted Keycloak user {$userId} after local registration failure");
        } catch (\Throwable $e) {
            Log::warning("Failed to delete Keycloak user {$userId}: " . $e->getMessage());
        }
    }

    /**
     * Create user in Keycloak
     */
    public function createKeycloakUser(array $data): ?string
    {
        try {
            $adminToken = $this->getAdminAccessToken();

            if (!$adminToken) {
                Log::error('Failed to get admin token for Keycloak user creation');
                return null;
            }

            // Force lowercase email
            $data['email'] = strtolower(trim($data['email']));
            // Normalize role for Keycloak (lowercase)
            $targetRole = isset($data['role']) ? strtolower($data['role']) : 'company';

            // Check if user already exists in Keycloak
            $existingUser = $this->findKeycloakUserByEmail($data['email'], $adminToken);
            if ($existingUser) {
                Log::info('User already exists in Keycloak: ' . $data['email'] . ' (ID: ' . $existingUser['id'] . ')');

                $this->resetKeycloakUserPassword($existingUser['id'], $data['password'], $adminToken);
                // Ensure user is fully set up
                $this->ensureUserFullySetup($existingUser['id'], $adminToken);
                // Ensure role is assigned
                $this->assignRoleToUser($existingUser['id'], $targetRole, $adminToken);
                return $existingUser['id'];
            }

            $response = $this->httpClient->post("/admin/realms/{$this->realm}/users", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'username' => $data['email'],
                    'email' => $data['email'],
                    'enabled' => true,
                    'emailVerified' => true,
                    'requiredActions' => [], // No required actions - account is fully set up
                    'firstName' => $data['first_name'] ?? 'Company',
                    'lastName' => $data['last_name'] ?? 'User',
                    'attributes' => [
                        'role' => $data['role'] ?? 'COMPANY',
                        'origin' => 'recrutiTN_admin'
                    ],
                ],
            ]);

            // Get user ID from Location header
            $location = $response->getHeader('Location');
            if (!empty($location)) {
                $parts = explode('/', $location[0]);
                $userId = end($parts);
                Log::info('User created in Keycloak with ID: ' . $userId);

                // IMPORTANT: Keycloak sometimes doesn't set the password correctly in the initial POST
                // or sets it as temporary. We force a reset here to be 100% sure.
                $this->resetKeycloakUserPassword($userId, $data['password'], $adminToken);

                // Ensure user is fully enabled and has no required actions
                $this->ensureUserFullySetup($userId, $adminToken);

                // Assign role to user
                $this->assignRoleToUser($userId, $targetRole, $adminToken);

                return $userId;
            }

            return null;
        } catch (\GuzzleHttp\Exception\ClientException $e) {
            $response = $e->getResponse();
            $statusCode = $response ? $response->getStatusCode() : 0;
            $body = $response ? $response->getBody()->getContents() : '';

            // If user already exists (409 Conflict), try to find and return the user ID
            if ($statusCode === 409) {
                Log::warning('User already exists in Keycloak (409), attempting to find and fix user: ' . $data['email']);
                $adminToken = $this->getAdminAccessToken();
                if ($adminToken) {
                    $existingUser = $this->findKeycloakUserByEmail($data['email'], $adminToken);
                    if ($existingUser) {
                        // Update password for existing user
                        $this->resetKeycloakUserPassword($existingUser['id'], $data['password'], $adminToken);
                        // Force fix the account
                        $this->ensureUserFullySetup($existingUser['id'], $adminToken);
                        // Re-assign role just in case
                        $this->assignRoleToUser($existingUser['id'], $targetRole, $adminToken);
                        return $existingUser['id'];
                    }
                }
            }

            Log::error('Keycloak user creation failed: ' . $e->getMessage() . ' | Status: ' . $statusCode . ' | Body: ' . $body);
            return null;
        } catch (\Exception $e) {
            Log::error('Keycloak user creation failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Find user in Keycloak by email
     */
    public function findKeycloakUserByEmail(string $email, ?string $adminToken = null): ?array
    {
        try {
            $response = $this->httpClient->get("/admin/realms/{$this->realm}/users", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                ],
                'query' => [
                    'email' => $email,
                    'exact' => 'true',
                ],
            ]);

            $users = json_decode($response->getBody()->getContents(), true);
            return !empty($users) ? $users[0] : null;
        } catch (\Exception $e) {
            Log::error('Failed to find Keycloak user by email: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Ensure user is fully set up in Keycloak (enabled, email verified, no required actions)
     */
    public function ensureUserFullySetup(string $userId, ?string $adminToken = null): void
    {
        try {
            if (!$adminToken) {
                $adminToken = $this->getAdminAccessToken();
            }

            if (!$adminToken) {
                Log::error("Cannot ensure user setup: Failed to get admin token");
                return;
            }

            // First, get the current user to preserve other fields
            $getResponse = $this->httpClient->get("/admin/realms/{$this->realm}/users/{$userId}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                ],
            ]);

            $userData = json_decode($getResponse->getBody()->getContents(), true);

            $email = (string) ($userData['email'] ?? '');
            $username = (string) ($userData['username'] ?? $email);
            $firstName = trim((string) ($userData['firstName'] ?? ''));
            $lastName = trim((string) ($userData['lastName'] ?? ''));

            // Some realms enforce profile completeness (first + last name).
            if ($firstName === '') {
                $localPart = explode('@', $username)[0] ?? '';
                $firstName = $localPart !== '' ? ucfirst($localPart) : 'User';
            }
            if ($lastName === '') {
                $lastName = 'User';
            }

            // Update user with required fields
            $this->httpClient->put("/admin/realms/{$this->realm}/users/{$userId}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'enabled' => true,
                    'emailVerified' => true,
                    'email' => $email,
                    'username' => $username,
                    'firstName' => $firstName,
                    'lastName' => $lastName,
                    'requiredActions' => [], // MUST BE EMPTY ARRAY
                ],
            ]);

            Log::info("User {$userId} ({$email}) fully set up in Keycloak (enabled, email verified, complete profile, No Required Actions)");
        } catch (\Exception $e) {
            Log::error("CRITICAL: Failed to ensure user {$userId} is fully set up: " . $e->getMessage());
        }
    }

    /**
     * Find and fix a user by email
     */
    public function fixUserByEmail(string $email): bool
    {
        try {
            $adminToken = $this->getAdminAccessToken();
            if (!$adminToken) {
                return false;
            }

            $keycloakUser = $this->findKeycloakUserByEmail($email, $adminToken);
            if (!$keycloakUser) {
                return false;
            }

            $this->ensureUserFullySetup($keycloakUser['id'], $adminToken);
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to fix user by email: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Update password for existing Keycloak user (Public wrapper)
     */
    public function updateKeycloakPassword(string $email, string $newPassword): bool
    {
        try {
            $adminToken = $this->getAdminAccessToken();
            if (!$adminToken)
                return false;

            $user = $this->findKeycloakUserByEmail($email, $adminToken);
            if (!$user)
                return false;

            $this->resetKeycloakUserPassword($user['id'], $newPassword, $adminToken);
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to update Keycloak password for {$email}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Update email/username for an existing Keycloak user.
     */
    public function updateKeycloakEmail(string $oldEmail, string $newEmail): bool
    {
        try {
            $oldEmail = strtolower(trim($oldEmail));
            $newEmail = strtolower(trim($newEmail));
            if ($oldEmail === '' || $newEmail === '') {
                return false;
            }

            $adminToken = $this->getAdminAccessToken();
            if (!$adminToken) {
                return false;
            }

            $user = $this->findKeycloakUserByEmail($oldEmail, $adminToken)
                ?? $this->findKeycloakUserByEmail($newEmail, $adminToken);

            if (!$user || empty($user['id'])) {
                Log::warning("Keycloak user not found for email update: {$oldEmail} -> {$newEmail}");
                return false;
            }

            $this->httpClient->put("/admin/realms/{$this->realm}/users/{$user['id']}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'email' => $newEmail,
                    'username' => $newEmail,
                    'emailVerified' => true,
                    'enabled' => true,
                    'requiredActions' => [],
                ],
            ]);

            Log::info("Updated Keycloak email: {$oldEmail} -> {$newEmail}");
            return true;
        } catch (\Exception $e) {
            Log::error("Failed to update Keycloak email {$oldEmail} -> {$newEmail}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Reset password for existing Keycloak user
     */
    public function resetKeycloakUserPassword(string $userId, string $newPassword, string $adminToken): void
    {
        try {
            $this->httpClient->put("/admin/realms/{$this->realm}/users/{$userId}/reset-password", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'type' => 'password',
                    'value' => $newPassword,
                    'temporary' => false,
                ],
            ]);

            Log::info("Password reset for Keycloak user {$userId}");

            // Explicitly clear any remaining required actions after password reset
            $this->httpClient->put("/admin/realms/{$this->realm}/users/{$userId}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'requiredActions' => [],
                    'emailVerified' => true,
                    'enabled' => true
                ],
            ]);
        } catch (\Exception $e) {
            Log::warning("Failed to reset password or clear actions for Keycloak user {$userId}: " . $e->getMessage());
        }
    }

    /**
     * Assign role to user in Keycloak
     */
    protected function assignRoleToUser(string $userId, string $role, string $adminToken): void
    {
        try {
            // Try role aliases + case-insensitivity (e.g. recruiter/recruteur)
            $roleData = null;
            $normalizedRole = strtolower($role);
            $roleAliases = [
                'recruiter' => ['recruiter', 'recruteur'],
                'recruteur' => ['recruteur', 'recruiter'],
            ];

            $baseVariants = $roleAliases[$normalizedRole] ?? [$role];
            $rolesToTry = [];
            foreach ($baseVariants as $variant) {
                $rolesToTry[] = $variant;
                $rolesToTry[] = strtoupper($variant);
                $rolesToTry[] = strtolower($variant);
            }
            $rolesToTry = array_values(array_unique($rolesToTry));

            foreach ($rolesToTry as $r) {
                try {
                    $roleResponse = $this->httpClient->get("/admin/realms/{$this->realm}/roles/{$r}", [
                        'headers' => ['Authorization' => 'Bearer ' . $adminToken],
                    ]);
                    $roleData = json_decode($roleResponse->getBody()->getContents(), true);
                    $role = $r; // Found it
                    break;
                } catch (\Exception $e) {
                    continue; // Try next variant
                }
            }

            if (!$roleData) {
                Log::warning("Role variant not found in Keycloak for user {$userId}: tried " . implode(', ', $rolesToTry));
                return;
            }

            // Assign role to user
            $this->httpClient->post("/admin/realms/{$this->realm}/users/{$userId}/role-mappings/realm", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => [$roleData],
            ]);

            Log::info("Role '{$role}' assigned successfully to user {$userId} in Keycloak");
        } catch (\Exception $e) {
            // Role assignment is not critical for basic login, but log the error
            Log::warning("Failed to assign role '{$role}' to user {$userId}: " . $e->getMessage());
        }
    }

    /**
     * Public alias for getAdminAccessToken (for use in controllers)
     */
    public function getAdminAccessTokenPublic(): ?string
    {
        return $this->getAdminAccessToken();
    }

    /**
     * Enable or disable a Keycloak user account
     */
    public function setKeycloakUserEnabled(string $userId, bool $enabled, ?string $adminToken = null): void
    {
        try {
            if (!$adminToken) {
                $adminToken = $this->getAdminAccessToken();
            }
            if (!$adminToken) {
                Log::error("Cannot toggle user status: failed to get admin token");
                return;
            }

            $this->httpClient->put("/admin/realms/{$this->realm}/users/{$userId}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $adminToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => ['enabled' => $enabled],
            ]);

            Log::info("Keycloak user {$userId} " . ($enabled ? 'enabled' : 'disabled'));
        } catch (\Exception $e) {
            Log::error("Failed to toggle Keycloak user {$userId} status: " . $e->getMessage());
        }
    }

    /**
     * Get admin access token for Keycloak Admin API
     */
    protected function getAdminAccessToken(): ?string
    {
        $cacheKey = 'keycloak_admin_token';

        // Check cache first (Redis may be down in dev; guard access)
        try {
            if ($token = Cache::get($cacheKey)) {
                return $token;
            }
        } catch (\Throwable $e) {
            Log::warning('Keycloak admin token cache read failed; continuing without cache', [
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $response = $this->httpClient->post("/realms/{$this->adminRealm}/protocol/openid-connect/token", [
                'form_params' => [
                    'grant_type' => 'password',
                    'client_id' => $this->adminClientId,
                    'username' => $this->adminUsername,
                    'password' => $this->adminPassword,
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            if (isset($data['access_token'])) {
                // Cache token for slightly less than its expiry
                $expiresIn = ($data['expires_in'] ?? 60) - 10;
                try {
                    Cache::put($cacheKey, $data['access_token'], $expiresIn);
                } catch (\Throwable $e) {
                    Log::warning('Keycloak admin token cache write failed; continuing without cache', [
                        'error' => $e->getMessage(),
                    ]);
                }

                return $data['access_token'];
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Failed to get Keycloak admin token: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Sync user from Keycloak token data
     */
    protected function syncUserFromToken(array $tokenData): User
    {
        $email = $tokenData['email'] ?? $tokenData['preferred_username'] ?? null;

        if (!$email) {
            throw new \Exception('No email found in token');
        }

        // Find existing user by email (case-insensitive), preferring verified user if duplicates exist
        $user = $this->findLocalUserByEmail(strtolower($email));

        if (!$user) {
            // Extract role from token
            $mappedRole = $this->mapKeycloakRoleToAppRole($this->extractRolesFromTokenPayload($tokenData));
            $role = $mappedRole !== '' ? $mappedRole : 'candidate';

            Log::info('Creating new user from Keycloak token', ['email' => $email, 'role' => $role]);

            $user = User::create([
                'email' => strtolower($email),
                'password_hash' => Hash::make(Str::random(32)), // Random password, not used
                'role' => strtolower($role),
                'is_active' => true,
            ]);

            // Create basic profile
            $this->createBasicProfile($user, $tokenData);
        } else {
            Log::info('Found existing user from Keycloak token', ['email' => $email, 'role' => $user->role, 'id' => $user->id]);
        }

        // Update last login
        $user->update(['last_login' => now()]);

        return $user;
    }

    /**
     * Map Keycloak roles to app roles
     */
    protected function mapKeycloakRoleToAppRole(array $roles): string
    {
        $mapping = config('keycloak.role_mapping', []);

        foreach ($roles as $role) {
            $role = strtolower($role);
            if (isset($mapping[$role])) {
                return $mapping[$role];
            }
            if (in_array($role, ['candidate', 'company', 'company_admin', 'recruiter', 'recruteur', 'admin', 'superadmin'], true)) {
                return $role;
            }
        }

        return '';
    }

    /**
     * Create basic profile from token data
     */
    protected function createBasicProfile(User $user, array $tokenData): void
    {
        $firstName = $tokenData['given_name'] ?? '';
        $lastName = $tokenData['family_name'] ?? '';
        if ($user->isCandidate()) {
            Candidate::create([
                'user_id' => $user->id,
                'first_name' => $firstName,
                'last_name' => $lastName,
            ]);
        } elseif ($user->isCompanyAdmin()) {
            // Only create if no company profile exists yet
            if (!Company::where('user_id', $user->id)->exists()) {
                Company::create([
                    'user_id' => $user->id,
                    'name' => trim($firstName . ' ' . $lastName) ?: $user->email,
                ]);
            }
        }
    }

    /**
     * Decode JWT token without verification
     */
    protected function decodeToken(string $token): array
    {
        $payload = $this->decodeJwtSegment($token, 1, 'payload');

        if (!$payload) {
            throw new \Exception('Invalid token payload');
        }

        return $payload;
    }

    protected function extractRolesFromTokenPayload(array $tokenData): array
    {
        $roles = $tokenData['realm_access']['roles'] ?? [];
        $resourceAccess = $tokenData['resource_access'] ?? [];

        foreach ($resourceAccess as $clientAccess) {
            $clientRoles = $clientAccess['roles'] ?? [];
            if (is_array($clientRoles)) {
                $roles = array_merge($roles, $clientRoles);
            }
        }

        return array_values(array_unique(array_map(
            static fn($role) => strtolower((string) $role),
            $roles
        )));
    }

    protected function decodeJwtSegment(string $token, int $index, string $segmentName): array
    {
        $parts = explode('.', $token);

        if (count($parts) !== 3 || !isset($parts[$index])) {
            throw new \RuntimeException('Invalid token format');
        }

        $decoded = json_decode($this->decodeBase64Url($parts[$index]), true);
        if (!is_array($decoded)) {
            throw new \RuntimeException("Invalid token {$segmentName}");
        }

        return $decoded;
    }

    protected function decodeBase64Url(string $value): string
    {
        $padding = strlen($value) % 4;
        if ($padding > 0) {
            $value .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        if ($decoded === false) {
            throw new \RuntimeException('Invalid base64url segment');
        }

        return $decoded;
    }

    protected function verifyJwtSignature(string $token, string $publicKeyPem, string $algorithm): bool
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }

        $opensslAlgorithm = match ($algorithm) {
            'RS256' => OPENSSL_ALGO_SHA256,
            'RS384' => OPENSSL_ALGO_SHA384,
            'RS512' => OPENSSL_ALGO_SHA512,
            default => null,
        };

        if ($opensslAlgorithm === null) {
            return false;
        }

        $signature = $this->decodeBase64Url($parts[2]);
        $key = openssl_pkey_get_public($publicKeyPem);
        if ($key === false) {
            return false;
        }

        return openssl_verify($parts[0] . '.' . $parts[1], $signature, $key, $opensslAlgorithm) === 1;
    }

    protected function resolveRealmFromIssuer(?string $issuer): ?string
    {
        if (!$issuer || !str_contains($issuer, '/realms/')) {
            return null;
        }

        $parts = explode('/realms/', $issuer, 2);
        if (count($parts) !== 2) {
            return null;
        }

        return trim(explode('/', $parts[1])[0]);
    }

    protected function getRealmPublicKeyPem(string $realm): ?string
    {
        $cacheKey = 'keycloak_public_key:' . $realm;

        try {
            $cached = Cache::get($cacheKey);
            if (is_string($cached) && $cached !== '') {
                return $cached;
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to read Keycloak public key from cache', [
                'realm' => $realm,
                'error' => $e->getMessage(),
            ]);
        }

        $publicKey = $realm === $this->realm ? trim((string) config('keycloak.realm_public_key', '')) : '';
        if ($publicKey === '' && config('keycloak.load_public_key_from_server', true)) {
            try {
                $response = $this->httpClient->get("/realms/{$realm}");
                $realmData = json_decode($response->getBody()->getContents(), true) ?? [];
                $publicKey = trim((string) ($realmData['public_key'] ?? ''));
            } catch (\Throwable $e) {
                Log::warning('Failed to fetch Keycloak public key from realm metadata', [
                    'realm' => $realm,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($publicKey === '') {
            return null;
        }

        $pem = str_contains($publicKey, 'BEGIN PUBLIC KEY')
            ? $publicKey
            : $this->formatPublicKeyAsPem($publicKey);

        try {
            Cache::put($cacheKey, $pem, now()->addHours(6));
        } catch (\Throwable $e) {
            Log::warning('Failed to cache Keycloak public key', [
                'realm' => $realm,
                'error' => $e->getMessage(),
            ]);
        }

        return $pem;
    }

    protected function formatPublicKeyAsPem(string $publicKey): string
    {
        $normalized = preg_replace('/\s+/', '', $publicKey) ?? '';
        return "-----BEGIN PUBLIC KEY-----\n"
            . chunk_split($normalized, 64, "\n")
            . "-----END PUBLIC KEY-----\n";
    }

    /**
     * Create role-specific profile
     */
    protected function createRoleProfile(User $user, array $data): void
    {
        switch (strtolower((string) $user->role)) {
            case 'candidate':
                Candidate::firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'first_name' => $data['first_name'] ?? $user->email,
                        'last_name' => $data['last_name'] ?? '',
                        'phone' => $data['phone'] ?? null,
                        'location' => $data['location'] ?? null,
                    ]
                );
                break;

            case 'company':
                Company::firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'name' => $data['company_name'] ?? $user->email,
                        'description' => $data['description'] ?? null,
                        'location' => $data['location'] ?? null,
                    ]
                );
                break;
        }
    }

    /**
     * Find local user by email while handling legacy case-variant duplicates.
     * Prefer verified users, then newest records.
     */
    protected function findLocalUserByEmail(string $email): ?User
    {
        return User::whereRaw('LOWER(email) = ?', [strtolower(trim($email))])
            ->orderByRaw('CASE WHEN email_verified_at IS NULL THEN 1 ELSE 0 END')
            ->orderByDesc('email_verified_at')
            ->orderByDesc('id')
            ->first();
    }
}
