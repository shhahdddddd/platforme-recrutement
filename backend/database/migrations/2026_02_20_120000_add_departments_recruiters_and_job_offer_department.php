<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('departments')) {
            Schema::create('departments', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('company_id');
                $table->string('name');
                $table->text('description')->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('recruiters')) {
            Schema::create('recruiters', function (Blueprint $table) {
                $table->increments('id');
                $table->integer('user_id');
                $table->integer('company_id');
                $table->integer('department_id')->nullable();
                $table->string('full_name')->nullable();
                $table->string('phone', 50)->nullable();
                $table->string('picture')->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->unique('user_id');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
                $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            });
        }

        if (Schema::hasTable('job_offers')) {
            Schema::table('job_offers', function (Blueprint $table) {
                if (!Schema::hasColumn('job_offers', 'department_id')) {
                    $table->integer('department_id')->nullable();
                    $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
                }
            });
        }

        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        DB::statement("
            ALTER TABLE users
            ADD CONSTRAINT users_role_check
            CHECK (LOWER(role) IN (
                'candidate',
                'company',
                'company_admin',
                'admin',
                'superadmin',
                'recruiter',
                'recruteur',
                'client'
            ))
        ");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('COMPANY', 'ADMIN', 'CANDIDATE'))");

        Schema::table('job_offers', function (Blueprint $table) {
            if (Schema::hasColumn('job_offers', 'department_id')) {
                $table->dropForeign(['department_id']);
                $table->dropColumn('department_id');
            }
        });

        Schema::dropIfExists('recruiters');
        Schema::dropIfExists('departments');
    }
};
