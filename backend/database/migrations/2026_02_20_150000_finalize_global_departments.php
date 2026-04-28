<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Clear existing departments/recruiters links to avoid FK issues
        DB::table('recruiters')->update(['department_id' => null]);
        DB::table('job_offers')->update(['department_id' => null]);

        // 2. Clear departments table
        DB::table('departments')->truncate();

        // 3. Make departments global by dropping company_id with CASCADE
        // We use statement because the column might already be gone from a failed attempt,
        // or the constraint name is unknown.
        try {
            DB::statement('ALTER TABLE departments DROP COLUMN IF EXISTS company_id CASCADE');
        } catch (\Exception $e) {
            // Column might already be gone
        }

        // Ensure name is unique since it's now global
        Schema::table('departments', function (Blueprint $table) {
            if (!Schema::hasColumn('departments', 'name')) {
                $table->string('name');
            }
            // Drop unique if exists is hard with Schema, so we use raw
            try {
                DB::statement('ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_unique');
            } catch (\Exception $e) {
            }

            $table->unique('name');
        });

        // 4. Seed the fixed list of departments
        $departments = [
            ['name' => 'graphic design'],
            ['name' => 'HR'],
            ['name' => 'produit managment'],
            ['name' => 'AI'],
            ['name' => 'mobile /web DEV'],
            ['name' => 'IOT'],
            ['name' => 'market sales'],
            ['name' => 'finance& accounting'],
            ['name' => 'IT department'],
        ];

        foreach ($departments as $dept) {
            DB::table('departments')->updateOrInsert(['name' => $dept['name']], $dept);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->integer('company_id')->nullable();
        });
    }
};
