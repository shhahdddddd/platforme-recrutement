<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('subscription_plans')) {
            Schema::create('subscription_plans', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name')->unique();
                $table->decimal('price', 12, 2);
                $table->integer('duration_days');
                $table->integer('max_job_offers')->default(0);
                $table->boolean('ai_features_enabled')->default(false);
                $table->timestamps();
            });
        }

        DB::table('subscription_plans')->upsert([
            [
                'name' => 'Basic',
                'price' => 300.00,
                'duration_days' => 90,
                'max_job_offers' => 10,
                'ai_features_enabled' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Pro',
                'price' => 700.00,
                'duration_days' => 180,
                'max_job_offers' => 30,
                'ai_features_enabled' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Premium',
                'price' => 2000.00,
                'duration_days' => 365,
                'max_job_offers' => 100,
                'ai_features_enabled' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ], ['name'], ['price', 'duration_days', 'max_job_offers', 'ai_features_enabled', 'updated_at']);

        if (Schema::hasTable('company_subscriptions')) {
            Schema::table('company_subscriptions', function (Blueprint $table) {
                if (!Schema::hasColumn('company_subscriptions', 'plan_id')) {
                    $table->integer('plan_id')->nullable()->after('company_id');
                }
                if (!Schema::hasColumn('company_subscriptions', 'is_auto_renew')) {
                    $table->boolean('is_auto_renew')->default(false)->after('payment_method');
                }
            });

            // Convert old boolean status to string status.
            try {
                DB::statement("
                    ALTER TABLE company_subscriptions
                    ALTER COLUMN status TYPE VARCHAR(20)
                    USING (CASE WHEN status = true THEN 'Active' ELSE 'Expired' END)
                ");
            } catch (\Throwable $e) {
                // Column may already be VARCHAR in environments where migration already ran.
            }
            DB::statement("ALTER TABLE company_subscriptions ALTER COLUMN status SET DEFAULT 'Active'");

            $basicId = (int) DB::table('subscription_plans')->where('name', 'Basic')->value('id');
            $proId = (int) DB::table('subscription_plans')->where('name', 'Pro')->value('id');
            $premiumId = (int) DB::table('subscription_plans')->where('name', 'Premium')->value('id');

            DB::statement("
                UPDATE company_subscriptions
                SET plan_id = CASE
                    WHEN COALESCE(amount, 0) >= 2000 THEN {$premiumId}
                    WHEN COALESCE(amount, 0) >= 700 THEN {$proId}
                    ELSE {$basicId}
                END
                WHERE plan_id IS NULL
            ");

            DB::statement("UPDATE company_subscriptions SET plan_id = {$basicId} WHERE plan_id IS NULL");
            DB::statement("ALTER TABLE company_subscriptions ALTER COLUMN plan_id SET NOT NULL");

            DB::statement("
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'company_subscriptions_plan_id_foreign'
                    ) THEN
                        ALTER TABLE company_subscriptions
                        ADD CONSTRAINT company_subscriptions_plan_id_foreign
                        FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE RESTRICT;
                    END IF;
                END$$;
            ");
        }

        if (Schema::hasTable('urgent_contacts')) {
            Schema::table('urgent_contacts', function (Blueprint $table) {
                if (!Schema::hasColumn('urgent_contacts', 'resolved_by')) {
                    $table->integer('resolved_by')->nullable()->after('status');
                }
                if (!Schema::hasColumn('urgent_contacts', 'resolved_at')) {
                    $table->timestamp('resolved_at')->nullable()->after('resolved_by');
                }
            });

            DB::statement("
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'urgent_contacts_resolved_by_foreign'
                    ) THEN
                        ALTER TABLE urgent_contacts
                        ADD CONSTRAINT urgent_contacts_resolved_by_foreign
                        FOREIGN KEY (resolved_by) REFERENCES admins(id) ON DELETE SET NULL;
                    END IF;
                END$$;
            ");
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('urgent_contacts')) {
            DB::statement('ALTER TABLE urgent_contacts DROP CONSTRAINT IF EXISTS urgent_contacts_resolved_by_foreign');
            Schema::table('urgent_contacts', function (Blueprint $table) {
                if (Schema::hasColumn('urgent_contacts', 'resolved_at')) {
                    $table->dropColumn('resolved_at');
                }
                if (Schema::hasColumn('urgent_contacts', 'resolved_by')) {
                    $table->dropColumn('resolved_by');
                }
            });
        }

        if (Schema::hasTable('company_subscriptions')) {
            DB::statement('ALTER TABLE company_subscriptions DROP CONSTRAINT IF EXISTS company_subscriptions_plan_id_foreign');
            Schema::table('company_subscriptions', function (Blueprint $table) {
                if (Schema::hasColumn('company_subscriptions', 'is_auto_renew')) {
                    $table->dropColumn('is_auto_renew');
                }
                if (Schema::hasColumn('company_subscriptions', 'plan_id')) {
                    $table->dropColumn('plan_id');
                }
            });
        }

        Schema::dropIfExists('subscription_plans');
    }
};

