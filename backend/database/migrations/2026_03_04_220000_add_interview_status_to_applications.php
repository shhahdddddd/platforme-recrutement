<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds 'interview' to the application_status PostgreSQL ENUM
 * and adds an 'interview_launched_at' timestamp column.
 *
 * Safe to run multiple times (idempotent checks included).
 */
return new class extends Migration {
    public function up(): void
    {
        // 1) Add the new enum value to PostgreSQL (idempotent via DO block)
        DB::unprepared("
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'interview'
                      AND enumtypid = (
                          SELECT oid FROM pg_type WHERE typname = 'application_status'
                      )
                ) THEN
                    ALTER TYPE application_status ADD VALUE 'interview';
                END IF;
            END$$;
        ");

        // 2) Add the interview_launched_at column if it doesn't exist
        Schema::table('applications', function (Blueprint $table) {
            if (!Schema::hasColumn('applications', 'interview_launched_at')) {
                $table->timestamp('interview_launched_at')->nullable()->after('ai_explanation');
            }
        });
    }

    public function down(): void
    {
        // PostgreSQL does not support removing an enum value.
        // We only roll back the column.
        Schema::table('applications', function (Blueprint $table) {
            if (Schema::hasColumn('applications', 'interview_launched_at')) {
                $table->dropColumn('interview_launched_at');
            }
        });
    }
};
