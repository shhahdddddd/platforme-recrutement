<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('applications')) {
            return;
        }

        Schema::table('applications', function (Blueprint $table) {
            if (!Schema::hasColumn('applications', 'ai_match_score')) {
                $table->float('ai_match_score')->nullable()->after('status');
            }
            if (!Schema::hasColumn('applications', 'ai_semantic_score')) {
                $table->float('ai_semantic_score')->nullable()->after('ai_match_score');
            }
            if (!Schema::hasColumn('applications', 'ai_skill_score')) {
                $table->float('ai_skill_score')->nullable()->after('ai_semantic_score');
            }
            if (!Schema::hasColumn('applications', 'ai_experience_score')) {
                $table->float('ai_experience_score')->nullable()->after('ai_skill_score');
            }
            if (!Schema::hasColumn('applications', 'ai_scored_at')) {
                $table->timestamp('ai_scored_at')->nullable()->after('ai_experience_score');
            }
            if (!Schema::hasColumn('applications', 'ai_error')) {
                $table->text('ai_error')->nullable()->after('ai_scored_at');
            }
            if (!Schema::hasColumn('applications', 'ai_confidence_score')) {
                $table->float('ai_confidence_score')->nullable()->after('ai_error');
            }
            if (!Schema::hasColumn('applications', 'ai_explanation')) {
                $table->json('ai_explanation')->nullable()->after('ai_confidence_score');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('applications')) {
            return;
        }

        Schema::table('applications', function (Blueprint $table) {
            foreach ([
                'ai_match_score',
                'ai_semantic_score',
                'ai_skill_score',
                'ai_experience_score',
                'ai_scored_at',
                'ai_error',
                'ai_confidence_score',
                'ai_explanation',
            ] as $column) {
                if (Schema::hasColumn('applications', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
