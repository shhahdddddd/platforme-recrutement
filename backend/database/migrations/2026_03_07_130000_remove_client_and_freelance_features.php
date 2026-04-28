<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Normalize legacy client users before tightening role constraint.
        if (Schema::hasTable('users')) {
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
            DB::statement("
                UPDATE users
                SET role = CASE
                    WHEN LOWER(role) IN ('client') THEN 'company'
                    WHEN LOWER(role) IN ('accountant', 'company_accountant', 'comptable') THEN 'company_admin'
                    WHEN LOWER(role) IN ('candidat') THEN 'candidate'
                    WHEN LOWER(role) IN ('administrator') THEN 'admin'
                    ELSE LOWER(role)
                END
            ");
            DB::statement("
                ALTER TABLE users
                ADD CONSTRAINT users_role_check
                CHECK (LOWER(role) IN (
                    'candidate',
                    'company',
                    'company_admin',
                    'admin',
                    'superadmin',
                    'recruiter',
                    'recruteur'
                ))
            ");
        }

        if (Schema::hasTable('job_offers')) {
            // Remove old client-owned offers before dropping the client ownership column.
            if (Schema::hasColumn('job_offers', 'client_id')) {
                DB::statement('DELETE FROM job_offers WHERE client_id IS NOT NULL');
            }

            DB::statement('ALTER TABLE job_offers DROP CONSTRAINT IF EXISTS chk_job_owner');
            DB::statement('ALTER TABLE job_offers DROP COLUMN IF EXISTS client_id CASCADE');

            // Remove freelance from offer_type enum and keep only fulltime/parttime/internship.
            if (Schema::hasColumn('job_offers', 'offer_type')) {
                DB::statement("UPDATE job_offers SET offer_type = 'fulltime' WHERE LOWER(offer_type::text) = 'freelance'");
                DB::statement('ALTER TABLE job_offers ALTER COLUMN offer_type TYPE TEXT USING offer_type::TEXT');
                DB::statement('DROP TYPE IF EXISTS offer_type CASCADE');
                DB::statement("CREATE TYPE offer_type AS ENUM ('fulltime', 'parttime', 'internship')");
                DB::statement('ALTER TABLE job_offers ALTER COLUMN offer_type TYPE offer_type USING offer_type::offer_type');
            }
        }

        DB::statement('DROP TABLE IF EXISTS client_meetings CASCADE');
        DB::statement('DROP TABLE IF EXISTS freelance_bids CASCADE');
        DB::statement('DROP TABLE IF EXISTS freelance_requirements CASCADE');
        DB::statement('DROP TABLE IF EXISTS clients CASCADE');
    }

    public function down(): void
    {
        // Destructive cleanup migration: no automatic rollback.
    }
};
