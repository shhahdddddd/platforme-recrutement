<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FcmToken;
use App\Models\Notification;
use App\Services\FirebaseNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    protected $firebaseService;

    public function __construct(FirebaseNotificationService $firebaseService)
    {
        $this->firebaseService = $firebaseService;
    }

    /**
     * Get push notification diagnostics.
     */
    public function diagnostics(Request $request)
    {
        $user = $request->user();

        // Check Firebase credentials file
        $credentialsPath = config('services.firebase.credentials_file');
        $credentialsExist = file_exists($credentialsPath);
        $credentialsValid = false;
        $credentialsError = null;

        if ($credentialsExist) {
            $content = file_get_contents($credentialsPath);
            $json = json_decode($content);
            if ($json !== null) {
                $credentialsValid = true;
            } else {
                $credentialsError = json_last_error_msg();
            }
        }

        // Check FCM tokens for user
        $fcmTokens = FcmToken::where('user_id', $user->id)
            ->select('token', 'platform', 'last_seen_at', 'created_at')
            ->get();

        // Try to get access token
        $accessToken = null;
        $accessTokenError = null;
        try {
            $reflection = new \ReflectionMethod($this->firebaseService, 'getAccessToken');
            $reflection->setAccessible(true);
            $accessToken = $reflection->invoke($this->firebaseService);
        } catch (\Throwable $e) {
            $accessTokenError = $e->getMessage();
        }

        return response()->json([
            'firebase_config' => [
                'project_id' => config('services.firebase.project_id'),
                'credentials_path' => $credentialsPath,
                'credentials_exist' => $credentialsExist,
                'credentials_valid_json' => $credentialsValid,
                'credentials_error' => $credentialsError,
            ],
            'access_token' => [
                'obtained' => $accessToken !== null,
                'prefix' => $accessToken ? substr($accessToken, 0, 20) . '...' : null,
                'error' => $accessTokenError,
            ],
            'fcm_tokens' => [
                'count' => $fcmTokens->count(),
                'tokens' => $fcmTokens->map(function ($token) {
                    return [
                        'token_prefix' => substr($token->token, 0, 20) . '...',
                        'platform' => $token->platform,
                        'last_seen' => $token->last_seen_at?->toIso8601String(),
                        'created_at' => $token->created_at?->toIso8601String(),
                    ];
                }),
            ],
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * Get user notifications.
     */
    public function index(Request $request)
    {
        $notifications = Notification::where('user_id', $request->user()->id)
            ->orderBy('sent_at', 'desc')
            ->paginate(20);

        $notifications->getCollection()->transform(
            fn(Notification $notif) => $this->transformNotification($notif)
        );

        return response()->json($notifications);
    }

    /**
     * Send test notification.
     */
    public function sendTest(Request $request)
    {
        $request->validate([
            'fcm_token' => 'required|string',
            'title' => 'required|string',
            'body' => 'required|string',
        ]);

        $success = $this->firebaseService->sendPushNotification(
            $request->fcm_token,
            $request->title,
            $request->body,
            ['type' => 'test', 'timestamp' => now()]
        );

        return response()->json([
            'success' => $success,
            'message' => $success ? 'Notification sent successfully' : 'Failed to send notification',
        ]);
    }

    /**
     * Mark notification as read.
     */
    public function markAsRead($id, Request $request)
    {
        $notification = Notification::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        if (!$notification->is_read) {
            $notification->update(['is_read' => true]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read',
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read',
        ]);
    }

    /**
     * Get unread notification count.
     */
    public function unreadCount(Request $request)
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'unread_count' => $count,
            ],
        ]);
    }

    /**
     * Delete notification.
     */
    public function destroy($id, Request $request)
    {
        $notification = Notification::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        $notification->delete();

        return response()->json(['message' => 'Notification deleted.']);
    }

    private function transformNotification(Notification $notification): array
    {
        $applicationTypes = [
            'NEW_APPLICATION', 'APPLICATION_ACCEPTED', 'APPLICATION_REJECTED',
            'INTERVIEW_SCHEDULED', 'INTERVIEW_ASSIGNED', 'INTERVIEW_LAUNCHED',
            'INTERN_CHAT_MESSAGE', 'QUIZ_READY', 'QUIZ_COMPLETED', 'MANUAL_QUIZ_READY'
        ];

        $type = (string) $notification->type;

        return [
            'id' => (int) $notification->id,
            'title' => $notification->title ?: 'Notification',
            'body' => $notification->message,
            'message' => $notification->message,
            'type' => $type,
            'reference_id' => $notification->reference_id !== null ? (int) $notification->reference_id : null,
            'application_id' => in_array($type, $applicationTypes, true) && $notification->reference_id !== null
                ? (int) $notification->reference_id
                : null,
            'sent_at' => $notification->sent_at?->toIso8601String(),
            'is_read' => (bool) $notification->is_read,
            'status' => $notification->status,
            'channel' => $notification->channel,
            'data' => $notification->data ?? [],
        ];
    }
}
