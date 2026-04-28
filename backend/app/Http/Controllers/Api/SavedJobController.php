<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavedJob;
use App\Models\JobOffer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SavedJobController extends Controller
{
    /**
     * Get all saved jobs for the authenticated user
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        $savedJobs = SavedJob::with('jobOffer.company')
            ->where('user_id', $user->id)
            ->get()
            ->map(function ($savedJob) {
                return [
                    'id' => $savedJob->jobOffer->id,
                    'title' => $savedJob->jobOffer->title,
                    'description' => $savedJob->jobOffer->description,
                    'location' => $savedJob->jobOffer->location,
                    'budget' => $savedJob->jobOffer->budget,
                    'offer_type' => $savedJob->jobOffer->offer_type,
                    'contract_type_detail' => $savedJob->jobOffer->contract_type_detail,
                    'date_posted' => $savedJob->jobOffer->date_posted,
                    'company' => $savedJob->jobOffer->company ? [
                        'name' => $savedJob->jobOffer->company->name,
                        'description' => $savedJob->jobOffer->company->description,
                    ] : null,
                    'saved_at' => $savedJob->created_at,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $savedJobs,
        ]);
    }

    /**
     * Toggle save/unsave a job
     */
    public function toggle(Request $request, $jobId)
    {
        $user = Auth::user();
        
        $jobOffer = JobOffer::findOrFail($jobId);
        
        $existingSave = SavedJob::where('user_id', $user->id)
            ->where('job_offer_id', $jobId)
            ->first();

        if ($existingSave) {
            // Unsave the job
            $existingSave->delete();
            $isSaved = false;
        } else {
            // Save the job
            SavedJob::create([
                'user_id' => $user->id,
                'job_offer_id' => $jobId,
            ]);
            $isSaved = true;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'is_saved' => $isSaved,
                'message' => $isSaved ? 'Job saved successfully' : 'Job removed from favorites',
            ],
        ]);
    }

    /**
     * Check if a job is saved by the user
     */
    public function check(Request $request, $jobId)
    {
        $user = Auth::user();
        
        $isSaved = SavedJob::where('user_id', $user->id)
            ->where('job_offer_id', $jobId)
            ->exists();

        return response()->json([
            'success' => true,
            'data' => [
                'is_saved' => $isSaved,
            ],
        ]);
    }
}
