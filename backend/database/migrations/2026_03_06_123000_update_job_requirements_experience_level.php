<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('job_requirements', function (Blueprint $table) {
            $table->dropColumn('minimum_level');
            $table->jsonb('experience_levels')->nullable();
        });
    }

    public function down()
    {
        Schema::table('job_requirements', function (Blueprint $table) {
            $table->dropColumn('experience_levels');
            $table->enum('minimum_level', ['beginner', 'intermediate', 'advanced'])->nullable();
        });
    }
};
