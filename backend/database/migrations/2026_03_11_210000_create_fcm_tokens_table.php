<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('fcm_tokens')) {
            return;
        }

        Schema::create('fcm_tokens', function (Blueprint $table) {
            $table->id();
            $table->integer('user_id');
            $table->string('token')->unique();
            $table->string('platform', 50)->default('unknown');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');

            $table->index('user_id');
            $table->index('platform');
        });

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'fcm_token')) {
            DB::statement("
                INSERT INTO fcm_tokens (user_id, token, platform, last_seen_at, created_at, updated_at)
                SELECT id, fcm_token, 'unknown', NOW(), NOW(), NOW()
                FROM users
                WHERE fcm_token IS NOT NULL AND fcm_token <> ''
                ON CONFLICT (token) DO NOTHING
            ");
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('fcm_tokens')) {
            Schema::drop('fcm_tokens');
        }
    }
};
