<?php

use App\Models\InternChatConversation;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Private channel for user's notifications
Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Private channel for chat conversations
// Only participants (recruiter or candidate) can join
Broadcast::channel('chat.conversation.{conversationId}', function ($user, int $conversationId) {
    $conversation = InternChatConversation::find($conversationId);

    if (!$conversation) {
        return false;
    }

    // Recruiter can join
    if ($user->recruiter && $user->recruiter->id === $conversation->recruiter_id) {
        return true;
    }

    // Candidate can join
    if ($user->candidate && $user->candidate->id === $conversation->candidate_id) {
        return true;
    }

    // Binome candidate can join
    if ($user->candidate && $user->candidate->id === $conversation->binome_candidate_id) {
        return true;
    }

    return false;
});

// Public presence channel for online/offline status (authenticated users only)
Broadcast::channel('presence', function ($user) {
    // Any authenticated user can listen to presence updates
    return $user !== null;
});
