<?php

namespace App\Services;

use GuzzleHttp\Client;

class SimpleFirebaseNotificationService
{
    protected $client;
    protected $serverKey;

    public function __construct()
    {
        $this->client = new Client();
        // Use a test server key for now - you should replace this with your actual FCM server key
        $this->serverKey = 'BKV9ngyoABcGMA7Vesptul0w9Ror_izYtPilVPr5ia-SI6Ykv7ZtvSTKDRVHx32D5Q5Rp9108mEw7ZXigeRBYfQ';
    }

    /**
     * Send a push notification using legacy FCM API (simpler)
     */
    public function sendPushNotification($fcmToken, $title, $body, $data = [])
    {
        if (empty($fcmToken)) {
            return false;
        }

        $url = "https://fcm.googleapis.com/fcm/send";

        $payload = [
            'to' => $fcmToken,
            'notification' => [
                'title' => $title,
                'body' => $body,
                'sound' => 'default',
            ],
            'data' => array_map('strval', $data),
            'priority' => 'high',
        ];

        try {
            $response = $this->client->post($url, [
                'headers' => [
                    'Authorization' => 'key=' . $this->serverKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => $payload,
            ]);

            $statusCode = $response->getStatusCode();
            $responseData = json_decode($response->getBody(), true);

            return $statusCode === 200 && ($responseData['success'] ?? 0) > 0;
        } catch (\Exception $e) {
            \Log::error('Simple FCM Send Error: ' . $e->getMessage());
            return false;
        }
    }
}
