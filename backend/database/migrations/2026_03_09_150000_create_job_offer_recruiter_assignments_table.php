<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('job_offer_recruiter_assignments')) {
            Schema::create('job_offer_recruiter_assignments', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('job_offer_id');
                $table->integer('recruiter_id');
                $table->timestamp('created_at')->useCurrent();

                $table->unique(['job_offer_id', 'recruiter_id'], 'job_offer_recruiter_unique');
                $table->foreign('job_offer_id')->references('id')->on('job_offers')->onDelete('cascade');
                $table->foreign('recruiter_id')->references('id')->on('recruiters')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('job_offer_recruiter_assignments');
    }
};
