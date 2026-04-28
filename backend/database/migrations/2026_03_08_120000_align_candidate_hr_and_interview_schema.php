<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'fcm_token')) {
                    $table->string('fcm_token')->nullable();
                }
            });
        }

        $this->addDeletedAtColumn('candidates');
        $this->addDeletedAtColumn('companies');
        $this->addDeletedAtColumn('job_offers');
        $this->addDeletedAtColumn('applications');

        // Preserve candidate CV references before removing candidates.cv_path.
        if (
            Schema::hasTable('candidates')
            && Schema::hasTable('cv_files')
            && Schema::hasColumn('candidates', 'cv_path')
        ) {
            DB::statement("
                INSERT INTO cv_files (candidate_id, file_path, parsed, uploaded_at)
                SELECT c.id, c.cv_path, TRUE, NOW()
                FROM candidates c
                WHERE c.cv_path IS NOT NULL
                  AND c.cv_path <> ''
                  AND NOT EXISTS (
                      SELECT 1
                      FROM cv_files f
                      WHERE f.candidate_id = c.id
                        AND f.file_path = c.cv_path
                  )
            ");
        }

        if (Schema::hasTable('candidates')) {
            Schema::table('candidates', function (Blueprint $table) {
                foreach (['cv_path', 'diploma', 'start_year', 'end_year'] as $column) {
                    if (Schema::hasColumn('candidates', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('hr')) {
            Schema::table('hr', function (Blueprint $table) {
                if (!Schema::hasColumn('hr', 'last_login')) {
                    $table->timestamp('last_login')->nullable();
                }
            });

            // Keep only one HR profile per user before adding UNIQUE(user_id).
            DB::statement("
                DELETE FROM hr a
                USING hr b
                WHERE a.user_id = b.user_id
                  AND a.id < b.id
            ");

            DB::statement("
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'hr_user_id_unique'
                    ) THEN
                        ALTER TABLE hr
                        ADD CONSTRAINT hr_user_id_unique UNIQUE (user_id);
                    END IF;
                END$$;
            ");
        }

        if (Schema::hasTable('interviews')) {
            Schema::table('interviews', function (Blueprint $table) {
                if (!Schema::hasColumn('interviews', 'conducted_by_hr_id')) {
                    $table->bigInteger('conducted_by_hr_id')->nullable();
                }
            });

            // Migrate old recruiter_id (company_id reference) to HR ownership when possible.
            if (Schema::hasColumn('interviews', 'recruiter_id') && Schema::hasTable('hr')) {
                DB::statement("
                    UPDATE interviews i
                    SET conducted_by_hr_id = mapped.hr_id
                    FROM (
                        SELECT company_id, MIN(id) AS hr_id
                        FROM hr
                        GROUP BY company_id
                    ) AS mapped
                    WHERE i.recruiter_id = mapped.company_id
                      AND i.conducted_by_hr_id IS NULL
                ");
            }

            DB::statement("
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'interviews_conducted_by_hr_id_foreign'
                    ) THEN
                        ALTER TABLE interviews
                        ADD CONSTRAINT interviews_conducted_by_hr_id_foreign
                        FOREIGN KEY (conducted_by_hr_id) REFERENCES hr(id) ON DELETE SET NULL;
                    END IF;
                END$$;
            ");

            if (Schema::hasColumn('interviews', 'recruiter_id')) {
                DB::statement('ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_recruiter_id_foreign');
                DB::statement('DROP INDEX IF EXISTS idx_interviews_recruiter');
                DB::statement('ALTER TABLE interviews DROP COLUMN IF EXISTS recruiter_id');
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('interviews')) {
            DB::statement('ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_conducted_by_hr_id_foreign');

            Schema::table('interviews', function (Blueprint $table) {
                if (!Schema::hasColumn('interviews', 'recruiter_id')) {
                    $table->integer('recruiter_id')->nullable();
                }
                if (Schema::hasColumn('interviews', 'conducted_by_hr_id')) {
                    $table->dropColumn('conducted_by_hr_id');
                }
            });
        }

        if (Schema::hasTable('hr')) {
            DB::statement('ALTER TABLE hr DROP CONSTRAINT IF EXISTS hr_user_id_unique');

            Schema::table('hr', function (Blueprint $table) {
                if (Schema::hasColumn('hr', 'last_login')) {
                    $table->dropColumn('last_login');
                }
            });
        }

        if (Schema::hasTable('candidates')) {
            Schema::table('candidates', function (Blueprint $table) {
                if (!Schema::hasColumn('candidates', 'cv_path')) {
                    $table->string('cv_path')->nullable();
                }
                if (!Schema::hasColumn('candidates', 'diploma')) {
                    $table->string('diploma')->nullable();
                }
                if (!Schema::hasColumn('candidates', 'start_year')) {
                    $table->string('start_year')->nullable();
                }
                if (!Schema::hasColumn('candidates', 'end_year')) {
                    $table->string('end_year')->nullable();
                }
            });
        }

        $this->dropDeletedAtColumn('applications');
        $this->dropDeletedAtColumn('job_offers');
        $this->dropDeletedAtColumn('companies');
        $this->dropDeletedAtColumn('candidates');

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (Schema::hasColumn('users', 'fcm_token')) {
                    $table->dropColumn('fcm_token');
                }
            });
        }
    }

    private function addDeletedAtColumn(string $tableName): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (!Schema::hasColumn($tableName, 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable();
            }
        });
    }

    private function dropDeletedAtColumn(string $tableName): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (Schema::hasColumn($tableName, 'deleted_at')) {
                $table->dropColumn('deleted_at');
            }
        });
    }
};

