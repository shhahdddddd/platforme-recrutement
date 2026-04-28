<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            if (!Schema::hasColumn('applications', 'ai_degree_score')) {
                $table->float('ai_degree_score')->nullable()->after('ai_experience_score');
            }
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            if (Schema::hasColumn('applications', 'ai_degree_score')) {
                $table->dropColumn('ai_degree_score');
            }
        });
    }
};
