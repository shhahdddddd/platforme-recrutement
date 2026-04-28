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
        Schema::table('subscription_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('subscription_plans', 'plan_type')) {
                $table->enum('plan_type', ['company', 'startup'])->default('company')->after('name');
            }
            if (!Schema::hasColumn('subscription_plans', 'description')) {
                $table->text('description')->nullable()->after('plan_type');
            }
            if (!Schema::hasColumn('subscription_plans', 'max_job_posts')) {
                $table->integer('max_job_posts')->default(0)->after('max_job_offers');
            }
            if (!Schema::hasColumn('subscription_plans', 'has_ai_access')) {
                $table->boolean('has_ai_access')->default(false)->after('ai_features_enabled');
            }
            if (!Schema::hasColumn('subscription_plans', 'has_priority_support')) {
                $table->boolean('has_priority_support')->default(false)->after('has_ai_access');
            }
            if (!Schema::hasColumn('subscription_plans', 'has_advanced_analytics')) {
                $table->boolean('has_advanced_analytics')->default(false)->after('has_priority_support');
            }
            if (!Schema::hasColumn('subscription_plans', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('has_advanced_analytics');
            }
            if (!Schema::hasColumn('subscription_plans', 'display_order')) {
                $table->integer('display_order')->default(0)->after('is_active');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropColumn(['plan_type', 'description', 'max_job_posts', 'has_ai_access', 'has_priority_support', 'has_advanced_analytics', 'is_active', 'display_order']);
        });
    }
};
