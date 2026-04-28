<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Google\Auth\HttpHandler\HttpHandlerFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class FirebaseNotificationService
{
    protected Client $client;
    protected string $projectId;

    public function __construct()
    {
        $this->client = new Client();
        $this->projectId = (string) config('services.firebase.project_id');
    }

    /**
     * Send a push notification via Firebase FCM v1 API.
     */
    public function sendPushNotification(string $fcmToken, string $title, string $body, array $data = []): bool
    {
        $result = $this->sendPushNotificationWithResult($fcmToken, $title, $body, $data);
        return (bool) $result['success'];
    }

    /**
     * Send a push notification and return detailed delivery result.
     *
     * @return array{success: bool, error_code: ?string, error_message: ?string}
     */
    public function sendPushNotificationWithResult(string $fcmToken, string $title, string $body, array $data = []): array
    {
        if (empty($fcmToken)) {
            return [
                'success' => false,
                'error_code' => 'EMPTY_TOKEN',
                'error_message' => 'FCM token is empty.',
            ];
        }

        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            return [
                'success' => false,
                'error_code' => 'ACCESS_TOKEN_UNAVAILABLE',
                'error_message' => 'Unable to get Firebase access token.',
            ];
        }

        $url = "https://fcm.googleapis.com/v1/projects/{$this->projectId}/messages:send";

        $payload = [
            'message' => [
                'token' => $fcmToken,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                ],
                'data' => array_map('strval', $data), // FCM data values must be strings
                'android' => [
                    'priority' => 'high',
                    'notification' => [
                        'sound' => 'default',
                        'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                    ],
                ],
                'apns' => [
                    'payload' => [
                        'aps' => [
                            'sound' => 'default',
                        ],
                    ],
                ],
            ],
        ];

        try {
            $response = $this->client->post($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $accessToken,
                    'Content-Type' => 'application/json',
                ],
                'json' => $payload,
            ]);

            return [
                'success' => $response->getStatusCode() === 200,
                'error_code' => null,
                'error_message' => null,
            ];
        } catch (\Throwable $e) {
            $error = $this->extractFcmError($e);
            Log::error('FCM Send Error', [
                'error_code' => $error['error_code'],
                'error_message' => $error['error_message'],
            ]);

            return [
                'success' => false,
                'error_code' => $error['error_code'],
                'error_message' => $error['error_message'],
            ];
        }
    }

    /**
     * Get OAuth2 Access Token for FCM v1.
     */
    protected function getAccessToken(): ?string
    {
        $credentialsPath = (string) config('services.firebase.credentials_file');
        $cacheKey = 'firebase:access_token';

        if (!file_exists($credentialsPath)) {
            Log::warning('Firebase credentials file not found', ['path' => $credentialsPath]);
            return null;
        }

        try {
            if ($cachedToken = Cache::get($cacheKey)) {
                return $cachedToken;
            }

            // First check if JSON is valid
            $content = file_get_contents($credentialsPath);
            $json = json_decode($content);

            if ($json === null) {
                Log::error('Firebase credentials file contains invalid JSON', [
                    'error' => json_last_error_msg(),
                ]);
                return null;
            }

            $scopes = ['https://www.googleapis.com/auth/firebase.messaging'];
            $credentials = new ServiceAccountCredentials($scopes, $credentialsPath);
            
            // FIX: Windows SSL certificate issue - create custom handler with SSL verify disabled for local dev
            $httpHandler = $this->createHttpHandler();
            $token = $credentials->fetchAuthToken($httpHandler);

            $accessToken = $token['access_token'] ?? null;
            if ($accessToken) {
                // Keep a small safety margin before expiry.
                Cache::put($cacheKey, $accessToken, now()->addMinutes(50));
            }

            return $accessToken;
        } catch (\Throwable $e) {
            Log::error('FCM Token Fetch Error', ['message' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Create HTTP handler with SSL verification disabled for local development.
     * This fixes Windows cURL SSL certificate issues.
     */
    private function createHttpHandler(): callable
    {
        $client = new Client([
            'verify' => false, // Disable SSL verify for local dev (Windows fix)
            'timeout' => 30,
        ]);
        
        return HttpHandlerFactory::build($client);
    }

    public function isInvalidTokenError(?string $errorCode): bool
    {
        if (!$errorCode) {
            return false;
        }

        return in_array($errorCode, ['UNREGISTERED', 'INVALID_ARGUMENT'], true);
    }

    /**
     * @return array{error_code: ?string, error_message: ?string}
     */
    private function extractFcmError(\Throwable $e): array
    {
        if (!$e instanceof RequestException || !$e->hasResponse()) {
            return [
                'error_code' => null,
                'error_message' => $e->getMessage(),
            ];
        }

        $body = (string) $e->getResponse()->getBody();
        $decoded = json_decode($body, true);
        $error = $decoded['error'] ?? [];
        $details = $error['details'] ?? [];

        $fcmErrorCode = null;
        foreach ($details as $detail) {
            if (($detail['@type'] ?? null) === 'type.googleapis.com/google.firebase.fcm.v1.FcmError') {
                $fcmErrorCode = $detail['errorCode'] ?? null;
                break;
            }
        }

        return [
            'error_code' => $fcmErrorCode ?: ($error['status'] ?? null),
            'error_message' => $error['message'] ?? $e->getMessage(),
        ];
    }
}
