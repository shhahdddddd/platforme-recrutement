<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('manual_quiz_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('manual_quiz_id')->constrained('manual_quizzes')->onDelete('cascade');
            $table->foreignId('manual_quiz_question_id')->constrained('manual_quiz_questions')->onDelete('cascade');
            $table->string('selected_choice', 1);
            $table->boolean('is_correct');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('manual_quiz_answers');
    }
};
