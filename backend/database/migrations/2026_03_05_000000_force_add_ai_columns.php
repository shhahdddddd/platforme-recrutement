<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Force add columns via DB statement because Schema builder has cached table definitions sometimes
        DB::unprepared("
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_match_score FLOAT;
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_semantic_score FLOAT;
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_skill_score FLOAT;
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_experience_score FLOAT;
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMP NULL;
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_error TEXT;
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_confidence_score FLOAT;
            ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_explanation JSONB;
        ");
    }

    public function down(): void
    {
        //
    }
};
