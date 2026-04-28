<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private string $conversationGroupIndex = 'intern_chat_messages_conversation_id_is_group_message_index';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('intern_chat_messages', function (Blueprint $table) {
            // For group messages, receiver can be null (broadcast to all conversation members)
            $table->foreignId('receiver_user_id')
                ->nullable()
                ->change();
        });

        if (!Schema::hasColumn('intern_chat_messages', 'is_group_message')) {
            Schema::table('intern_chat_messages', function (Blueprint $table) {
                // Flag to indicate this is a group/broadcast message
                $table->boolean('is_group_message')
                    ->default(false)
                    ->after('receiver_user_id');
            });
        }

        if (
            Schema::hasColumn('intern_chat_messages', 'conversation_id') &&
            Schema::hasColumn('intern_chat_messages', 'is_group_message') &&
            !$this->indexExists('intern_chat_messages', $this->conversationGroupIndex)
        ) {
            Schema::table('intern_chat_messages', function (Blueprint $table) {
                $table->index(
                    ['conversation_id', 'is_group_message'],
                    $this->conversationGroupIndex
                );
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('intern_chat_messages', function (Blueprint $table) {
            if ($this->indexExists('intern_chat_messages', $this->conversationGroupIndex)) {
                $table->dropIndex($this->conversationGroupIndex);
            }
            if (Schema::hasColumn('intern_chat_messages', 'is_group_message')) {
                $table->dropColumn('is_group_message');
            }
            $table->foreignId('receiver_user_id')->nullable(false)->change();
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
