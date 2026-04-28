<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        // 1. Add cv_path to applications
        if (Schema::hasTable('applications')) {
            Schema::table('applications', function (Blueprint $table) {
                if (!Schema::hasColumn('applications', 'cv_path')) {
                    $table->string('cv_path')->nullable()->after('job_offer_id');
                }
            });
        }

        // 2. Change job_offers.status to VARCHAR to allow flexible values like 'pas active'
        // Since it's PostgreSQL and uses an ENUM type, we use raw SQL to change the column type
        DB::unprepared("
            ALTER TABLE job_offers ALTER COLUMN status TYPE VARCHAR(50);
            ALTER TABLE job_offers ALTER COLUMN status DROP DEFAULT;
            ALTER TABLE job_offers ALTER COLUMN status SET DEFAULT 'open';
        ");
    }

    public function down()
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('cv_path');
        });

        // We won't revert the VARCHAR to ENUM easily in down() without potential data loss or complexity
    }
};
