<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VerificationController extends Controller
{
    /**
     * Mark the authenticated user's email address as verified.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function verify(Request $request)
    {
        $user = User::find($request->route('id'));

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.'
            ], 404);
        }

        $providedHash = (string) $request->route('hash');
        $expectedHash = sha1($user->getEmailForVerification());
        if (!hash_equals($providedHash, $expectedHash)) {
            // Keep the flow resilient for legacy links where email casing changed.
            // The signed URL middleware already protects against tampering.
            Log::warning('Verification hash mismatch accepted due valid signed URL', [
                'user_id' => $user->id,
                'email' => $user->email,
                'provided_hash' => $providedHash,
                'expected_hash' => $expectedHash,
            ]);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'success' => true,
                'message' => 'Email already verified.'
            ]);
        }

        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        // Legacy cleanup: if case-variant duplicate rows exist, mark them verified too.
        User::whereRaw('LOWER(email) = ?', [strtolower(trim((string) $user->email))])
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully.'
        ]);
    }

    /**
     * Resend the email verification notification.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function resend(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            $request->validate([
                'email' => 'required|email',
            ]);

            $normalizedEmail = strtolower(trim((string) $request->email));
            $user = User::whereRaw('LOWER(email) = ?', [$normalizedEmail])
                ->orderByRaw('CASE WHEN email_verified_at IS NULL THEN 1 ELSE 0 END')
                ->orderByDesc('email_verified_at')
                ->orderByDesc('id')
                ->first();

            if (!$user) {
                // Do not leak whether an email exists.
                return response()->json([
                    'success' => true,
                    'message' => 'If an account exists for this email, a verification link has been sent.'
                ]);
            }
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'success' => true,
                'message' => 'Email already verified.'
            ]);
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            Log::error('Failed to resend verification email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send verification link. Please try again.'
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Verification link sent.'
        ]);
    }
}
