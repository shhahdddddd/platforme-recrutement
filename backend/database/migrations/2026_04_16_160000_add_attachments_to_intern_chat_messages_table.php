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
        Schema::table('intern_chat_messages', function (Blueprint $table) {
            $table->text('message')->nullable()->change();
        });

        if (!Schema::hasColumn('intern_chat_messages', 'attachment_original_name')) {
            Schema::table('intern_chat_messages', function (Blueprint $table) {
                $table->string('attachment_original_name')->nullable()->after('message');
            });
        }

        if (!Schema::hasColumn('intern_chat_messages', 'attachment_path')) {
            Schema::table('intern_chat_messages', function (Blueprint $table) {
                $table->string('attachment_path')->nullable()->after('attachment_original_name');
            });
        }

        if (!Schema::hasColumn('intern_chat_messages', 'attachment_mime_type')) {
            Schema::table('intern_chat_messages', function (Blueprint $table) {
                $table->string('attachment_mime_type')->nullable()->after('attachment_path');
            });
        }

        if (!Schema::hasColumn('intern_chat_messages', 'attachment_size')) {
            Schema::table('intern_chat_messages', function (Blueprint $table) {
                $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime_type');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('intern_chat_messages', 'message')) {
            DB::table('intern_chat_messages')
                ->whereNull('message')
                ->update(['message' => '']);
        }

        Schema::table('intern_chat_messages', function (Blueprint $table) {
            if (Schema::hasColumn('intern_chat_messages', 'attachment_original_name')) {
                $table->dropColumn('attachment_original_name');
            }
            if (Schema::hasColumn('intern_chat_messages', 'attachment_path')) {
                $table->dropColumn('attachment_path');
            }
            if (Schema::hasColumn('intern_chat_messages', 'attachment_mime_type')) {
                $table->dropColumn('attachment_mime_type');
            }
            if (Schema::hasColumn('intern_chat_messages', 'attachment_size')) {
                $table->dropColumn('attachment_size');
            }
            $table->text('message')->nullable(false)->change();
        });
    }
};
