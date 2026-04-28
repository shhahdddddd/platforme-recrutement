<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('job_offers', function (Blueprint $table) {
            $table->enum('seniority_level', ['junior', 'mid', 'senior', 'lead'])->nullable();
            $table->integer('quiz_questions_count')->default(8);
            $table->json('relevant_clusters')->nullable();
            $table->json('key_terms')->nullable();
            $table->boolean('knowledge_base_ready')->default(true);
            $table->text('preparation_error')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_offers', function (Blueprint $table) {
            $table->dropColumn([
                'seniority_level',
                'quiz_questions_count',
                'relevant_clusters',
                'key_terms',
                'knowledge_base_ready',
                'preparation_error'
            ]);
        });
    }
};
