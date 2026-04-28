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
        Schema::create('binome_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignId('inviter_candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->foreignId('invited_candidate_id')->constrained('candidates')->cascadeOnDelete();
            $table->string('invited_email');
            $table->enum('status', ['pending', 'accepted', 'rejected', 'cancelled'])->default('pending');
            $table->timestamp('responded_at')->nullable();
            $table->text('message')->nullable();
            $table->timestamps();

            // Indexes
            $table->unique(['application_id', 'invited_candidate_id'], 'unique_invitation_per_app');
            $table->index(['invited_candidate_id', 'status']);
            $table->index(['inviter_candidate_id', 'status']);
            $table->index('application_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('binome_invitations');
    }
};
