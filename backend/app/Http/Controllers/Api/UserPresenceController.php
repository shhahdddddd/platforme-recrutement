<?php

namespace App\Http\Controllers\Api;

use App\Events\UserPresenceUpdated;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class UserPresenceController extends Controller
{
    /**
     * Mark user as online.
     */
    public function markOnline(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        // Update database
        User::where('id', $user->id)->update([
            'is_online' => true,
            'last_seen_at' => now(),
        ]);

        // Cache online status for 2 minutes
        Cache::put("user:{$user->id}:online", true, 120);

        // Broadcast presence update
        broadcast(new UserPresenceUpdated($user->id, true, now()->toIso8601String()))->toOthers();

        return response()->json([
            'success' => true,
            'message' => 'User marked as online',
        ]);
    }

    /**
     * Mark user as offline.
     */
    public function markOffline(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $now = now();

        // Update database
        User::where('id', $user->id)->update([
            'is_online' => false,
            'last_seen_at' => $now,
        ]);

        // Remove from cache
        Cache::forget("user:{$user->id}:online");

        // Broadcast presence update
        broadcast(new UserPresenceUpdated($user->id, false, $now->toIso8601String()))->toOthers();

        return response()->json([
            'success' => true,
            'message' => 'User marked as offline',
        ]);
    }

    /**
     * Get online status for multiple users.
     */
    public function getUsersStatus(Request $request)
    {
        $userIds = $request->input('user_ids', []);
        
        if (empty($userIds)) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $users = User::whereIn('id', $userIds)
            ->select(['id', 'is_online', 'last_seen_at'])
            ->get();

        $statuses = $users->map(function ($user) {
            // Check cache first (more real-time)
            $isOnline = Cache::get("user:{$user->id}:online", $user->is_online);
            $lastSeenRaw = $user->last_seen_at;
            $lastSeenAt = null;
            if ($lastSeenRaw instanceof \DateTimeInterface) {
                $lastSeenAt = $lastSeenRaw->format(DATE_ATOM);
            } elseif (is_string($lastSeenRaw) && trim($lastSeenRaw) !== '') {
                try {
                    $lastSeenAt = Carbon::parse($lastSeenRaw)->toIso8601String();
                } catch (\Throwable $e) {
                    $lastSeenAt = null;
                }
            }
            
            return [
                'user_id' => $user->id,
                'is_online' => $isOnline,
                'last_seen_at' => $lastSeenAt,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $statuses,
        ]);
    }

    /**
     * Heartbeat to keep user online status active.
     */
    public function heartbeat(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        // Refresh cache
        Cache::put("user:{$user->id}:online", true, 120);

        // Update last seen occasionally (every 5 minutes)
        $lastUpdate = Cache::get("user:{$user->id}:last_seen_update");
        if (!$lastUpdate || now()->diffInMinutes($lastUpdate) >= 5) {
            User::where('id', $user->id)->update([
                'last_seen_at' => now(),
            ]);
            Cache::put("user:{$user->id}:last_seen_update", now(), 300);
        }

        return response()->json([
            'success' => true,
            'message' => 'Heartbeat received',
        ]);
    }
}
