<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AiScoringCompleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $userId,
        public int $applicationId,
        public ?float $aiMatchScore = null,
        public ?float $aiDegreeScore = null,
        public ?float $aiSemanticScore = null,
        public ?float $aiSkillScore = null,
        public ?float $aiExperienceScore = null,
        public ?float $aiConfidenceScore = null,
        public ?string $aiExplanation = null,
        public ?string $aiScoredAt = null,
        public ?string $aiError = null
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->userId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'AiScoringCompleted';
    }

    public function broadcastWith(): array
    {
        return [
            'application_id' => $this->applicationId,
            'ai_match_score' => $this->aiMatchScore,
            'ai_degree_score' => $this->aiDegreeScore,
            'ai_semantic_score' => $this->aiSemanticScore,
            'ai_skill_score' => $this->aiSkillScore,
            'ai_experience_score' => $this->aiExperienceScore,
            'ai_confidence_score' => $this->aiConfidenceScore,
            'ai_explanation' => $this->aiExplanation,
            'ai_scored_at' => $this->aiScoredAt,
            'ai_error' => $this->aiError,
        ];
    }
}
