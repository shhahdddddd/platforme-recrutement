<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the interviews table:
 *  - Adds new interview_type_enum values (test_technique, test_rh_telephonique, test_rh_video, test_psychotechnique)
 *  - Adds application_id FK to link to the application
 *  - Adds recruiter_id FK to assign a recruiter (for test_technique)
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('interviews')) {
            return;
        }

        // 1) Add new enum values to interview_type_enum (idempotent)
        $newValues = ['test_technique', 'test_rh_telephonique', 'test_rh_video', 'test_psychotechnique'];

        foreach ($newValues as $val) {
            DB::statement("
                DO \$\$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_type WHERE typname = 'interview_type_enum'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        WHERE t.typname = 'interview_type_enum'
                          AND e.enumlabel = '{$val}'
                    ) THEN
                        ALTER TYPE interview_type_enum ADD VALUE '{$val}';
                    END IF;
                END\$\$;
            ");
        }

        // 2) Add application_id column if missing
        if (!Schema::hasColumn('interviews', 'application_id')) {
            DB::statement("
                ALTER TABLE interviews
                ADD COLUMN application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL
            ");
        }

        // 3) Add recruiter_id column (FK to recruiters) if missing
        //    (the old recruiter_id was dropped in a previous migration; this one points to recruiters not companies)
        if (!Schema::hasColumn('interviews', 'recruiter_id')) {
            DB::statement("
                ALTER TABLE interviews
                ADD COLUMN recruiter_id INTEGER REFERENCES recruiters(id) ON DELETE SET NULL
            ");
        }

        // 4) Add interview_mode column if missing
        if (!Schema::hasColumn('interviews', 'interview_mode')) {
            DB::statement("
                ALTER TABLE interviews
                ADD COLUMN interview_mode VARCHAR(20) DEFAULT 'online'
            ");
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('interviews')) {
            return;
        }

        DB::statement('ALTER TABLE interviews DROP COLUMN IF EXISTS interview_mode');
        DB::statement('ALTER TABLE interviews DROP COLUMN IF EXISTS recruiter_id');
        DB::statement('ALTER TABLE interviews DROP COLUMN IF EXISTS application_id');
        // Note: PostgreSQL doesn't support removing enum values, so we leave them.
    }
};
