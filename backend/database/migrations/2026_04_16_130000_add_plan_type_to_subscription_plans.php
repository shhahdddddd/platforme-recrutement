<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->enum('plan_type', ['company', 'startup'])
                ->default('company')
                ->after('name');
            $table->text('description')
                ->nullable()
                ->after('plan_type');
            $table->integer('max_job_posts')
                ->default(0)
                ->after('max_job_offers');
            $table->boolean('has_ai_access')
                ->default(false)
                ->after('ai_features_enabled');
            $table->boolean('has_priority_support')
                ->default(false)
                ->after('has_ai_access');
            $table->boolean('has_advanced_analytics')
                ->default(false)
                ->after('has_priority_support');
            $table->boolean('is_active')
                ->default(true)
                ->after('has_advanced_analytics');
            $table->integer('display_order')
                ->default(0)
                ->after('is_active');

            $table->index(['plan_type', 'is_active']);
            $table->index('display_order');
        });

        // Update existing plans - Basic/Pro/Premium as Company plans
        DB::table('subscription_plans')
            ->whereIn('name', ['Basic', 'Pro', 'Premium'])
            ->update([
                'plan_type' => 'company',
                'max_job_posts' => DB::raw('max_job_offers'),
                'has_ai_access' => DB::raw('ai_features_enabled'),
                'is_active' => true,
                'display_order' => DB::raw('id'),
            ]);

        // Insert default Startup plans
        $now = now();
        DB::table('subscription_plans')->insert([
            [
                'name' => 'Startup Basic',
                'plan_type' => 'startup',
                'description' => 'Perfect for early-stage startups looking to hire their first team members',
                'price' => 150.00,
                'duration_days' => 90,
                'max_job_offers' => 5,
                'max_job_posts' => 5,
                'ai_features_enabled' => false,
                'has_ai_access' => false,
                'has_priority_support' => false,
                'has_advanced_analytics' => false,
                'is_active' => true,
                'display_order' => 4,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Startup Growth',
                'plan_type' => 'startup',
                'description' => 'For growing startups ready to scale their team with AI-powered matching',
                'price' => 350.00,
                'duration_days' => 180,
                'max_job_offers' => 15,
                'max_job_posts' => 15,
                'ai_features_enabled' => true,
                'has_ai_access' => true,
                'has_priority_support' => true,
                'has_advanced_analytics' => false,
                'is_active' => true,
                'display_order' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Startup Scale',
                'plan_type' => 'startup',
                'description' => 'Full-featured plan for scaling startups with advanced analytics and priority support',
                'price' => 800.00,
                'duration_days' => 365,
                'max_job_offers' => 50,
                'max_job_posts' => 50,
                'ai_features_enabled' => true,
                'has_ai_access' => true,
                'has_priority_support' => true,
                'has_advanced_analytics' => true,
                'is_active' => true,
                'display_order' => 6,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropIndex(['plan_type', 'is_active']);
            $table->dropIndex(['display_order']);
            $table->dropColumn([
                'plan_type',
                'description',
                'max_job_posts',
                'has_ai_access',
                'has_priority_support',
                'has_advanced_analytics',
                'is_active',
                'display_order',
            ]);
        });
    }
};
