<?php

namespace App\Jobs;

use App\Models\Application;
use App\Models\Candidate;
use App\Services\AiMatchingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use App\Jobs\ScoreApplicationJob;


/**
 * ProcessCvJob
 *
 * Queued background job that:
 *   1. Receives a CV absolute path + candidate user ID
 *   2. Finds every pending application that candidate has for open job offers
 *   3. Runs AI scoring via AiMatchingService for each application
 *   4. Persists the AI scores back to the applications table
 *
 * This job is dispatched by CvController::upload() after CV storage.
 */
class ProcessCvJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of seconds the job can run before timing out.
     * AI scoring can take a while for large CVs + slow Ollama models.
     */
    public int $timeout = 600;

    /**
     * Number of times the job may be attempted.
     */
    public int $tries = 2;

    public function __construct(
        public readonly int $userId,
        public readonly string $cvAbsolutePath,
    ) {
    }

    public function handle(AiMatchingService $aiMatchingService): void
    {
        $path = $this->cvAbsolutePath;

        // Resolve absolute path if it is a URL (e.g. from the cv_path column)
        if (str_starts_with($path, 'http')) {
            $filename = basename($path);
            $path = Storage::disk('public')->path('cvs/' . $filename);
        }

        Log::info('[ProcessCvJob] Starting CV processing', [
            'user_id' => $this->userId,
            'cv_path' => $path,
        ]);

        if (!file_exists($path)) {
            Log::error('[ProcessCvJob] CV file not found on disk, aborting.', [
                'cv_path' => $path,
            ]);
            return;
        }

        // Use the resolved path for the rest of the job
        $cvPath = $path;

        // Resolve the candidate record
        $candidate = Candidate::where('user_id', $this->userId)->first();
        if (!$candidate) {
            Log::warning('[ProcessCvJob] Candidate record not found for user', [
                'user_id' => $this->userId,
            ]);
            return;
        }

        if (!$aiMatchingService->isEnabled()) {
            $reason = $aiMatchingService->disabledReason();
            $this->markApplicationsAsAiDisabled($candidate->id, $reason);
            Log::info('[ProcessCvJob] AI scoring skipped (disabled)', [
                'candidate_id' => $candidate->id,
                'reason' => $reason,
            ]);
            return;
        }

        // Find all applications for this candidate that need (re-)scoring:
        //   - never scored yet (ai_scored_at IS NULL), OR
        //   - previously failed with an error (ai_error IS NOT NULL)
        $applications = Application::where('candidate_id', $candidate->id)
            ->where(function ($q) {
                $q->whereNull('ai_scored_at')
                    ->orWhereNotNull('ai_error');
            })
            ->get();

        if ($applications->isEmpty()) {
            Log::info('[ProcessCvJob] No pending un-scored applications found.', [
                'candidate_id' => $candidate->id,
            ]);
            return;
        }

        Log::info('[ProcessCvJob] Dispatching scoring jobs', [
            'candidate_id' => $candidate->id,
            'application_count' => $applications->count(),
        ]);

        $runInline = $this->shouldRunAiScoringInline();

        foreach ($applications as $application) {
            if ($runInline) {
                ScoreApplicationJob::dispatchSync(
                    $application->id,
                    $cvPath
                );
            } else {
                ScoreApplicationJob::dispatch(
                    $application->id,
                    $cvPath
                );
            }
        }

        Log::info('[ProcessCvJob] CV processing completed (jobs dispatched)', [
            'user_id' => $this->userId,
            'dispatched_count' => $applications->count(),
            'inline' => $runInline,
        ]);
    }

    private function markApplicationsAsAiDisabled(int $candidateId, string $reason): void
    {
        if (!Schema::hasColumn('applications', 'ai_error')) {
            return;
        }

        $query = Application::where('candidate_id', $candidateId);
        if (Schema::hasColumn('applications', 'ai_match_score')) {
            $query->whereNull('ai_match_score');
        }

        // Use bulk update for better performance and to avoid potential timeouts in the loop
        $query->update(['ai_error' => $reason]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('[ProcessCvJob] Job failed permanently', [
            'user_id' => $this->userId,
            'error' => $exception->getMessage(),
        ]);
    }

    private function shouldRunAiScoringInline(): bool
    {
        $configured = env('AI_SCORING_INLINE');
        if ($configured !== null && $configured !== '') {
            return (bool) filter_var($configured, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }

        return app()->environment('local');
    }
}
