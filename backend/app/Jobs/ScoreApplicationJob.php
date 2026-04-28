<?php

namespace App\Jobs;

use App\Models\Application;
use App\Models\JobOffer;
use App\Services\AiMatchingService;
use App\Events\AiScoringCompleted;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ScoreApplicationJob implements ShouldQueue
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
        public readonly int $applicationId,
    ) {
    }

    public function handle(AiMatchingService $aiMatchingService, \App\Services\SubscriptionFeatureService $subscriptionFeatureService): void
    {
        $application = Application::with('jobOffer.skills')->find($this->applicationId);

        if (!$application || !$application->jobOffer) {
            Log::warning('[ScoreApplicationJob] Application or Job Offer not found', [
                'application_id' => $this->applicationId,
            ]);
            return;
        }

        // Check if company has AI features enabled in their subscription
        $company = $application->jobOffer->company;
        if ($company && !$subscriptionFeatureService->hasAiMatching($company)) {
            Log::info('[ScoreApplicationJob] Company does not have AI features enabled, skipping AI scoring', [
                'application_id' => $application->id,
                'company_id' => $company->id,
            ]);
            
            if (Schema::hasColumn('applications', 'ai_error')) {
                $application->ai_error = $subscriptionFeatureService->getFeatureNotEnabledMessage('ai_matching');
                $application->save();
            }
            
            $this->broadcastScoringComplete($application, $application->ai_error);
            return;
        }

        // Resolve CV path from database
        $cvPathFromDb = $application->cv_path;
        $filename = basename($cvPathFromDb);
        $path = Storage::disk('public')->path('cvs' . DIRECTORY_SEPARATOR . $filename);
        // Normalize path separators for Windows
        $path = str_replace('/', DIRECTORY_SEPARATOR, $path);

        Log::info('[ScoreApplicationJob] Starting AI scoring', [
            'application_id' => $application->id,
            'cv_path' => $path,
        ]);

        if (!file_exists($path)) {
            Log::error('[ScoreApplicationJob] CV file not found on disk, aborting.', [
                'cv_path' => $path,
            ]);
            return;
        }

        $cvPath = $path;

        try {
            $scores = $aiMatchingService->scoreCvForJob($cvPath, $application->jobOffer);

            if (is_array($scores)) {
                $persistable = [];
                foreach ($scores as $column => $value) {
                    if (Schema::hasColumn('applications', $column)) {
                        $persistable[$column] = $value;
                    }
                }
                $application->fill($persistable);

                if (Schema::hasColumn('applications', 'ai_scored_at')) {
                    $application->ai_scored_at = now();
                }
                if (Schema::hasColumn('applications', 'ai_error')) {
                    $application->ai_error = null;
                }

                $application->save();

                Log::info('[ScoreApplicationJob] Application scored successfully', [
                    'application_id' => $application->id,
                    'ai_match_score' => $scores['ai_match_score'] ?? null,
                ]);

                // Broadcast WebSocket event to notify the recruiter
                $this->broadcastScoringComplete($application, null);
            } else {
                if (Schema::hasColumn('applications', 'ai_error')) {
                    $application->ai_error = $aiMatchingService->lastFailureReason() ?: 'AI scoring unavailable at this time.';
                    $application->save();
                }
                // Broadcast WebSocket event with error
                $this->broadcastScoringComplete($application, $application->ai_error);
            }
        } catch (\Throwable $e) {
            Log::error('[ScoreApplicationJob] Failed to score application', [
                'application_id' => $application->id,
                'error' => $e->getMessage(),
            ]);

            if (Schema::hasColumn('applications', 'ai_error')) {
                $application->ai_error = 'Exception: ' . $e->getMessage();
                $application->save();
            }
            // Broadcast WebSocket event with error
            $this->broadcastScoringComplete($application, $application->ai_error);
        }
    }

    /**
     * Broadcast WebSocket event to notify the recruiter that scoring is complete.
     */
    private function broadcastScoringComplete(Application $application, ?string $error): void
    {
        try {
            // Get the recruiter (company user) who owns the job offer
            $jobOffer = $application->jobOffer;
            if (!$jobOffer || !$jobOffer->user_id) {
                Log::warning('[ScoreApplicationJob] Cannot broadcast - no recruiter found', [
                    'application_id' => $application->id,
                ]);
                return;
            }

            AiScoringCompleted::dispatch(
                userId: $jobOffer->user_id,
                applicationId: $application->id,
                aiMatchScore: $application->ai_match_score,
                aiDegreeScore: $application->ai_degree_score,
                aiSemanticScore: $application->ai_semantic_score,
                aiSkillScore: $application->ai_skill_score,
                aiExperienceScore: $application->ai_experience_score,
                aiConfidenceScore: $application->ai_confidence_score,
                aiExplanation: $application->ai_explanation,
                aiScoredAt: $application->ai_scored_at?->toIso8601String(),
                aiError: $error
            );

            Log::info('[ScoreApplicationJob] WebSocket event dispatched', [
                'application_id' => $application->id,
                'user_id' => $jobOffer->user_id,
            ]);
        } catch (\Throwable $e) {
            Log::error('[ScoreApplicationJob] Failed to broadcast WebSocket event', [
                'application_id' => $application->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('[ScoreApplicationJob] Job failed permanently', [
            'application_id' => $this->applicationId,
            'error' => $exception->getMessage(),
        ]);
    }
}
