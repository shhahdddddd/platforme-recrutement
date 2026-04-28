<?php

namespace App\Services;

use App\Models\Company;
use App\Models\JobOffer;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class AiMatchingService
{
    public function __construct(private SubscriptionFeatureService $subscriptionFeatureService)
    {
    }

    private ?string $lastFailureReason = null;

    public function isEnabled(): bool
    {
        $configured = env('AI_MATCHING_ENABLED');
        if ($configured !== null && $configured !== '') {
            return (bool) filter_var($configured, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }

        return !$this->isLocalhostDevelopmentEnvironment();
    }

    public function disabledReason(): string
    {
        return 'AI scoring disabled on localhost development environment.';
    }

    /**
     * Check if company has AI features enabled in their subscription.
     */
    public function hasSubscriptionFeature(Company $company): bool
    {
        return $this->subscriptionFeatureService->hasAiMatching($company);
    }

    public function lastFailureReason(): ?string
    {
        return $this->lastFailureReason;
    }

    /**
     * Score one CV against one job offer using the existing Python AI stack.
     * Returns null when scoring fails.
     */
    public function scoreCvForJob(string $cvAbsolutePath, JobOffer $jobOffer): ?array
    {
        $this->lastFailureReason = null;

        if (!$this->isEnabled()) {
            $this->lastFailureReason = $this->disabledReason();
            Log::info('AI scoring skipped because AI is disabled in this environment', [
                'job_offer_id' => $jobOffer->id ?? null,
                'reason' => $this->lastFailureReason,
            ]);
            return null;
        }

        if (!is_file($cvAbsolutePath)) {
            $this->lastFailureReason = 'CV file not found for AI scoring.';
            Log::warning('CV file not found for AI scoring', ['cv_path' => $cvAbsolutePath]);
            return null;
        }

        $skills = $this->resolveJobSkills($jobOffer);
        $requirements = $this->resolveJobRequirements($jobOffer);
        $isInternship = $jobOffer->offer_type === 'internship';
        $timeout = (int) env('AI_MATCH_TIMEOUT_SECONDS', 600);

        $apiUrl = env('AI_DJANGO_API_URL', 'http://127.0.0.1:8002/api/score/');

        try {
            $response = \Illuminate\Support\Facades\Http::timeout($timeout)->post($apiUrl, [
                'job_id' => $jobOffer->id,
                'cv' => $cvAbsolutePath,
                'job_desc' => (string) (($jobOffer->title ?? '') . "\n\n" . ($jobOffer->description ?? '')),
                'skills_json' => $skills,
                'degrees' => $requirements['required_degrees'] ?? [],
                'exp_levels' => $requirements['experience_levels'] ?? [],
                'exp_years' => (float) ($requirements['required_experience_years'] ?? 0),
                'offer_type' => (string) ($jobOffer->offer_type ?? 'job'),
                'is_internship' => $isInternship,
                'duration' => $isInternship && isset($requirements['duration_months']) ? (int) $requirements['duration_months'] : 0,
            ]);

            if (!$response->successful()) {
                $this->lastFailureReason = 'AI scorer returned HTTP ' . $response->status() . '.';
                Log::warning('AI scorer API returned error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            $decoded = $response->json();

            if (!is_array($decoded)) {
                $this->lastFailureReason = 'AI scorer returned an invalid response.';
                Log::warning('AI scorer API returned non-JSON output', [
                    'output' => $response->body(),
                ]);
                return null;
            }

            if (isset($decoded['error'])) {
                $this->lastFailureReason = 'AI scorer error: ' . (string) $decoded['error'];
                Log::warning('AI scorer API returned internal error', [
                    'error' => $decoded['error'],
                ]);
                return null;
            }

            $matchScore = $this->normalizeScore($decoded['score'] ?? null);
            $semanticScore = $this->normalizeScore($decoded['semantic_score'] ?? null);
            $skillScore = $this->normalizeScore($decoded['skill_score'] ?? null);
            $experienceScore = $this->normalizeScore($decoded['experience_score'] ?? null);
            $degreeScore = $this->normalizeScore($decoded['degree_score'] ?? null);
            $confidenceScore = $this->normalizeScore($decoded['confidence_score'] ?? null);

            $guardedMatchScore = $this->applySkillCoverageGuard(
                $matchScore,
                $skillScore,
                count($skills)
            );

            return [
                'ai_match_score' => $guardedMatchScore,
                'ai_semantic_score' => $semanticScore,
                'ai_skill_score' => $skillScore,
                'ai_experience_score' => $experienceScore,
                'ai_degree_score' => $degreeScore,
                'ai_confidence_score' => $confidenceScore,
                'ai_explanation' => $this->normalizeExplanation($decoded['explanation'] ?? null),
            ];
        } catch (\Throwable $e) {
            $this->lastFailureReason = 'AI scoring request failed: ' . $e->getMessage();
            Log::warning('AI scoring API request failed', [
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Normalize score to [0, 1] regardless of whether source sends 0-1 or 0-100.
     */
    private function normalizeScore(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }
        $score = (float) $value;
        if ($score > 1.0) {
            $score = $score / 100.0;
        }
        if ($score < 0.0) {
            $score = 0.0;
        }
        if ($score > 1.0) {
            $score = 1.0;
        }
        return round($score, 4);
    }

    private function applySkillCoverageGuard(?float $matchScore, ?float $skillScore, int $requiredSkillCount): ?float
    {
        if ($matchScore === null) {
            return null;
        }

        if ($skillScore === null) {
            return $matchScore;
        }

        $penalty = 1.0;

        if ($requiredSkillCount <= 0) {
            if ($skillScore < 0.05 && $matchScore >= 0.75) {
                $penalty = 0.70;
            }
            return round(max(0.0, min(1.0, $matchScore * $penalty)), 4);
        }

        if ($requiredSkillCount === 1) {
            if ($skillScore < 0.10) {
                $penalty = 0.20;
            } elseif ($skillScore < 0.50) {
                $penalty = 0.60;
            }
        } else {
            if ($skillScore < 0.10) {
                $penalty = 0.10;
            } elseif ($skillScore < 0.25) {
                $penalty = 0.25;
            } elseif ($skillScore < 0.40) {
                $penalty = 0.45;
            } elseif ($skillScore < 0.60) {
                $penalty = 0.70;
            }
        }

        $guarded = max(0.0, min(1.0, $matchScore * $penalty));

        if ($skillScore < 0.10) {
            $cap = $requiredSkillCount === 1 ? 0.35 : 0.25;
            $guarded = min($guarded, $cap);
        }

        return round($guarded, 4);
    }

    private function resolveJobSkills(JobOffer $jobOffer): array
    {
        $isInternship = $jobOffer->offer_type === 'internship';
        $requirementsTable = $isInternship ? 'internship_requirements' : 'job_requirements';
        if (!Schema::hasTable($requirementsTable)) {
            return [];
        }

        // Determine which relationship to use based on offer type
        $relation = $isInternship ? 'internshipSkills' : 'skills';

        $jobOffer->loadMissing($relation);

        $skillsCollection = $isInternship
            ? $jobOffer->internshipSkills
            : $jobOffer->skills;

        $skills = $skillsCollection
            ->pluck('name')
            ->filter(fn($name) => is_string($name) && trim($name) !== '')
            ->map(fn($name) => trim((string) $name))
            ->unique()
            ->values()
            ->all();

        $text = trim((string) (($jobOffer->title ?? '') . ' ' . ($jobOffer->description ?? '')));
        if ($text !== '') {
            $skills = array_values(array_filter(
                $skills,
                fn($skill) => $this->skillInText($skill, $text)
            ));
        }

        return $skills;
    }

    private function skillInText(string $skill, string $text): bool
    {
        $skill = mb_strtolower(trim($skill));
        if ($skill === '') {
            return false;
        }

        $text = mb_strtolower($text);
        $parts = preg_split('~[\s.\-_/]+~', $skill, -1, PREG_SPLIT_NO_EMPTY);
        if (!$parts) {
            return false;
        }

        if (count($parts) === 1) {
            $token = preg_quote($parts[0], '~');
        } else {
            $tokens = array_map(fn($p) => preg_quote($p, '~'), $parts);
            $token = implode('[\s.\-_/]*', $tokens);
        }

        return (bool) preg_match('~(?<![a-z0-9])' . $token . '(?![a-z0-9])~i', $text);
    }

    private function normalizeExplanation(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }
        return $value;
    }

    private function isLocalhostDevelopmentEnvironment(): bool
    {
        if (!app()->environment('local')) {
            return false;
        }

        $appUrl = trim((string) config('app.url', ''));
        if ($appUrl === '') {
            return false;
        }

        $host = strtolower((string) parse_url($appUrl, PHP_URL_HOST));
        return in_array($host, ['localhost', '127.0.0.1', '::1', '[::1]'], true);
    }

    private function resolveJobRequirements(JobOffer $jobOffer): array
    {
        $isInternship = $jobOffer->offer_type === 'internship';
        $table = $isInternship ? 'internship_requirements' : 'job_requirements';
        if (!Schema::hasTable($table)) {
            return [
                'required_degrees' => [],
                'experience_levels' => [],
                'duration_months' => null
            ];
        }

        $req = \Illuminate\Support\Facades\DB::table($table)
            ->where('job_offer_id', $jobOffer->id)
            ->first();

        if (!$req) {
            return [
                'required_degrees' => [],
                'experience_levels' => [],
                'duration_months' => null
            ];
        }

        $degrees = [];
        if (isset($req->required_degrees)) {
            $degrees = is_string($req->required_degrees) ? json_decode($req->required_degrees, true) : (array) $req->required_degrees;
        }

        $levels = [];
        if (!$isInternship && isset($req->experience_levels)) {
            $levels = is_string($req->experience_levels) ? json_decode($req->experience_levels, true) : (array) $req->experience_levels;
        }

        return [
            'required_degrees' => is_array($degrees) ? $degrees : [],
            'experience_levels' => is_array($levels) ? $levels : [],
            'duration_months' => $isInternship ? ($req->duration_months ?? null) : null,
        ];
    }
}
