<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('interviews') || !Schema::hasColumn('interviews', 'scheduled_at')) {
            return;
        }

        DB::statement('ALTER TABLE interviews ALTER COLUMN scheduled_at DROP NOT NULL');
    }

    public function down(): void
    {
        if (!Schema::hasTable('interviews') || !Schema::hasColumn('interviews', 'scheduled_at')) {
            return;
        }

        DB::statement('UPDATE interviews SET scheduled_at = COALESCE(scheduled_at, created_at, NOW())');
        DB::statement('ALTER TABLE interviews ALTER COLUMN scheduled_at SET NOT NULL');
    }
};
