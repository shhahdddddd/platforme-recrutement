<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('applications')) {
            return;
        }

        Schema::table('applications', function (Blueprint $table) {
            if (!Schema::hasColumn('applications', 'ai_quiz_session_id')) {
                $table->string('ai_quiz_session_id')->nullable()->after('interview_launched_at');
            }
            if (!Schema::hasColumn('applications', 'ai_quiz_status')) {
                $table->string('ai_quiz_status', 50)->nullable()->after('ai_quiz_session_id');
            }
            if (!Schema::hasColumn('applications', 'ai_quiz_score')) {
                $table->float('ai_quiz_score')->nullable()->after('ai_quiz_status');
            }
            if (!Schema::hasColumn('applications', 'ai_quiz_error')) {
                $table->text('ai_quiz_error')->nullable()->after('ai_quiz_score');
            }
            if (!Schema::hasColumn('applications', 'ai_quiz_sent_at')) {
                $table->timestamp('ai_quiz_sent_at')->nullable()->after('ai_quiz_error');
            }
            if (!Schema::hasColumn('applications', 'ai_quiz_completed_at')) {
                $table->timestamp('ai_quiz_completed_at')->nullable()->after('ai_quiz_sent_at');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('applications')) {
            return;
        }

        Schema::table('applications', function (Blueprint $table) {
            foreach ([
                'ai_quiz_session_id',
                'ai_quiz_status',
                'ai_quiz_score',
                'ai_quiz_error',
                'ai_quiz_sent_at',
                'ai_quiz_completed_at',
            ] as $column) {
                if (Schema::hasColumn('applications', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
