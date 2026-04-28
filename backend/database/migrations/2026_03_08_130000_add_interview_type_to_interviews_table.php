<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('interviews')) {
            return;
        }

        DB::statement("
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'interview_type_enum'
                ) THEN
                    CREATE TYPE interview_type_enum AS ENUM ('telephonique', 'video-quizzes');
                END IF;
            END$$;
        ");

        DB::statement("
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'interview_type_enum'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'interview_type_enum'
                      AND e.enumlabel = 'video-quizzes'
                ) THEN
                    ALTER TYPE interview_type_enum ADD VALUE 'video-quizzes';
                END IF;
            END$$;
        ");

        DB::statement("
            ALTER TABLE interviews
            ADD COLUMN IF NOT EXISTS interview_type interview_type_enum
            DEFAULT 'telephonique'
        ");
    }

    public function down(): void
    {
        if (Schema::hasTable('interviews')) {
            DB::statement('ALTER TABLE interviews DROP COLUMN IF EXISTS interview_type');
        }

        DB::statement('DROP TYPE IF EXISTS interview_type_enum');
    }
};

