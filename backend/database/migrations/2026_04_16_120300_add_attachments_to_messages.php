<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private string $attachmentPathIndex = 'intern_chat_messages_attachment_path_index';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
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

        if (
            Schema::hasColumn('intern_chat_messages', 'attachment_path') &&
            !$this->indexExists('intern_chat_messages', $this->attachmentPathIndex)
        ) {
            Schema::table('intern_chat_messages', function (Blueprint $table) {
                $table->index('attachment_path', $this->attachmentPathIndex);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('intern_chat_messages', function (Blueprint $table) {
            if ($this->indexExists('intern_chat_messages', $this->attachmentPathIndex)) {
                $table->dropIndex($this->attachmentPathIndex);
            }
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
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        return DB::table('pg_indexes')
            ->where('schemaname', 'public')
            ->where('tablename', $table)
            ->where('indexname', $indexName)
            ->exists();
    }
};
