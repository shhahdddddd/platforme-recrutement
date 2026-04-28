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
        Schema::create('manual_quiz_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('manual_quiz_id')->constrained('manual_quizzes')->onDelete('cascade');
            $table->text('question_text');
            $table->json('choices'); # Array of strings
            $table->string('correct_choice', 1)->default('A');
            $table->text('explanation')->nullable();
            $table->string('difficulty')->default('medium');
            $table->integer('question_number');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('manual_quiz_questions');
    }
};
