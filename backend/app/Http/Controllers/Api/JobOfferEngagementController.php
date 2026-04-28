<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobOffer;
use App\Models\JobOfferComment;
use App\Models\JobOfferLike;
use App\Services\CompanyRealtimeNotificationService;
use Illuminate\Http\Request;

class JobOfferEngagementController extends Controller
{
    public function __construct(private CompanyRealtimeNotificationService $companyRealtimeNotificationService)
    {
    }

    public function stats(Request $request, int $jobId)
    {
        $user = $request->user();
        $job = JobOffer::findOrFail($jobId);

        $likesCount = JobOfferLike::where('job_offer_id', $job->id)->count();
        $commentsCount = JobOfferComment::where('job_offer_id', $job->id)->count();
        $isLiked = JobOfferLike::where('job_offer_id', $job->id)
            ->where('user_id', $user->id)
            ->exists();

        return response()->json([
            'success' => true,
            'data' => [
                'likes_count' => $likesCount,
                'comments_count' => $commentsCount,
                'is_liked' => $isLiked,
            ]
        ]);
    }

    public function toggleLike(Request $request, int $jobId)
    {
        $user = $request->user();
        if (!$user || !$user->isCandidate()) {
            return response()->json([
                'success' => false,
                'message' => 'Only candidates can like job offers.',
            ], 403);
        }
        $job = JobOffer::findOrFail($jobId);

        $existingLike = JobOfferLike::where('job_offer_id', $job->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existingLike) {
            $existingLike->delete();
            $isLiked = false;
        } else {
            JobOfferLike::create([
                'job_offer_id' => $job->id,
                'user_id' => $user->id,
            ]);
            $isLiked = true;

            // Real-time notification to the company owner.
            $this->companyRealtimeNotificationService->notifyJobLikedByCandidate($job, $user);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'is_liked' => $isLiked,
                'likes_count' => JobOfferLike::where('job_offer_id', $job->id)->count(),
            ]
        ]);
    }

    public function listComments(int $jobId)
    {
        $job = JobOffer::findOrFail($jobId);

        $comments = JobOfferComment::where('job_offer_id', $job->id)
            ->with(['user.candidate', 'user.company'])
            ->latest()
            ->limit(50)
            ->get()
            ->map(function (JobOfferComment $comment) {
                $candidate = $comment->user?->candidate;
                $company = $comment->user?->company;

                $displayName = $candidate
                    ? trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''))
                    : ($company?->name ?? ($comment->user?->email ?? 'User'));

                return [
                    'id' => $comment->id,
                    'content' => $comment->content,
                    'created_at' => optional($comment->created_at)->toIso8601String(),
                    'user' => [
                        'id' => $comment->user?->id,
                        'name' => trim($displayName) !== '' ? trim($displayName) : 'User',
                    ],
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $comments,
        ]);
    }

    public function addComment(Request $request, int $jobId)
    {
        $request->validate([
            'content' => 'required|string|min:1|max:1000',
        ]);

        $job = JobOffer::findOrFail($jobId);
        $user = $request->user();
        if (!$user || !$user->isCandidate()) {
            return response()->json([
                'success' => false,
                'message' => 'Only candidates can comment on job offers.',
            ], 403);
        }

        $comment = JobOfferComment::create([
            'job_offer_id' => $job->id,
            'user_id' => $user->id,
            'content' => trim($request->content),
        ]);

        $commentPreview = mb_substr(trim($comment->content), 0, 90);
        $this->companyRealtimeNotificationService->notifyJobCommentedByCandidate($job, $user, $commentPreview);

        return response()->json([
            'success' => true,
            'message' => 'Comment added successfully',
            'data' => [
                'id' => $comment->id,
                'content' => $comment->content,
                'created_at' => optional($comment->created_at)->toIso8601String(),
            ],
        ], 201);
    }
}
