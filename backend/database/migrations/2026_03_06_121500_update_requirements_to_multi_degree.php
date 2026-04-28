<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up()
    {
        Schema::table('job_requirements', function (Blueprint $table) {
            $table->dropColumn('cycle_eng');
            $table->jsonb('required_degrees')->nullable();
        });

        Schema::table('internship_requirements', function (Blueprint $table) {
            $table->dropColumn('cycle_eng');
            $table->jsonb('required_degrees')->nullable();
        });
    }

    public function down()
    {
        Schema::table('job_requirements', function (Blueprint $table) {
            $table->dropColumn('required_degrees');
            $table->boolean('cycle_eng')->default(false);
        });

        Schema::table('internship_requirements', function (Blueprint $table) {
            $table->dropColumn('required_degrees');
            $table->boolean('cycle_eng')->default(false);
        });
    }
};
