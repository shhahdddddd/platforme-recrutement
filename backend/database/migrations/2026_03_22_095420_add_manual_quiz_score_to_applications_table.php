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
        Schema::table('applications', function (Blueprint $table) {
            $table->decimal('manual_quiz_score', 5, 2)->nullable()->after('ai_quiz_score');
            $table->string('manual_quiz_status')->default('none')->after('ai_quiz_status');
            $table->timestamp('manual_quiz_completed_at')->nullable()->after('ai_quiz_completed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['manual_quiz_score', 'manual_quiz_status', 'manual_quiz_completed_at']);
        });
    }
};
