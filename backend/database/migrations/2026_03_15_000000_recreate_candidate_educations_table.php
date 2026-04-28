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
        // Drop old tables
        Schema::dropIfExists('universities');
        Schema::dropIfExists('diplomas');
        
        // Remove the table if it exists to start fresh with the new 1-to-N relationship
        Schema::dropIfExists('candidate_educations');

        Schema::create('candidate_educations', function (Blueprint $table) {
            $table->id();
            // Removed .unique() to allow multiple diplomas per candidate
            $table->foreignId('candidate_id')->constrained('candidates')->onDelete('cascade');
            $table->string('university')->nullable();
            $table->string('diploma')->nullable();
            $table->string('level')->nullable(); 
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('candidate_educations');
    }
};
