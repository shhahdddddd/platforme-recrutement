<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\User;
use App\Models\FcmToken;
use App\Services\FirebaseNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;

    public function __construct(
        public int $notificationId,
        public int $recipientId,
        public string $title,
        public string $body,
        public array $data = []
    ) {
    }

    /**
     * Exponential retry delays in seconds.
     */
    public function backoff(): array
    {
        return [5, 15, 45];
    }

    public function handle(FirebaseNotificationService $firebaseNotificationService): void
    {
        $notification = Notification::find($this->notificationId);
        $recipient = User::find($this->recipientId);

        if (!$notification || !$recipient) {
            Log::warning('SendPushNotificationJob: missing notification or recipient', [
                'notification_id' => $this->notificationId,
                'recipient_id' => $this->recipientId,
            ]);
            return;
        }

        $tokens = FcmToken::where('user_id', $recipient->id)->get();
        if ($tokens->isEmpty()) {
            $notification->update(['status' => 'failed']);
            Log::warning('SendPushNotificationJob: recipient has no FCM tokens', [
                'notification_id' => $this->notificationId,
                'recipient_id' => $this->recipientId,
            ]);
            return;
        }

        $sent = false;
        $hadNonInvalidError = false;
        $lastError = null;

        foreach ($tokens as $token) {
            $result = $firebaseNotificationService->sendPushNotificationWithResult(
                $token->token,
                $this->title,
                $this->body,
                $this->data
            );

            if ($result['success']) {
                $sent = true;
                $token->update(['last_seen_at' => now()]);
                continue;
            }

            $lastError = $result;

            if ($firebaseNotificationService->isInvalidTokenError($result['error_code'])) {
                $token->delete();
                continue;
            }

            $hadNonInvalidError = true;
        }

        if ($sent) {
            $notification->update(['status' => 'sent']);
            return;
        }

        $notification->update(['status' => 'failed']);

        if ($hadNonInvalidError) {
            throw new \RuntimeException(
                'Push send failed'
                . (!empty($lastError['error_code']) ? ' [' . $lastError['error_code'] . ']' : '')
                . (!empty($lastError['error_message']) ? ' ' . $lastError['error_message'] : '')
            );
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('SendPushNotificationJob failed after retries', [
            'notification_id' => $this->notificationId,
            'recipient_id' => $this->recipientId,
            'error' => $exception->getMessage(),
        ]);
    }
}
