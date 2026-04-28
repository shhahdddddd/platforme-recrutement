<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private string $applicationConversationTypeIndex = 'intern_chat_conversations_application_id_conversation_type_index';
    private string $binomeCandidateIndex = 'intern_chat_conversations_binome_candidate_id_index';
    private string $binomeCandidateForeign = 'intern_chat_conversations_binome_candidate_id_foreign';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('intern_chat_conversations', 'binome_candidate_id')) {
            Schema::table('intern_chat_conversations', function (Blueprint $table) {
                $table->foreignId('binome_candidate_id')
                    ->nullable()
                    ->after('candidate_id')
                    ->constrained('candidates')
                    ->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('intern_chat_conversations', 'conversation_type')) {
            Schema::table('intern_chat_conversations', function (Blueprint $table) {
                $table->enum('conversation_type', ['solo', 'duo'])
                    ->default('solo')
                    ->after('binome_candidate_id');
            });
        }

        if (
            Schema::hasColumn('intern_chat_conversations', 'application_id') &&
            Schema::hasColumn('intern_chat_conversations', 'conversation_type') &&
            !$this->indexExists('intern_chat_conversations', $this->applicationConversationTypeIndex)
        ) {
            Schema::table('intern_chat_conversations', function (Blueprint $table) {
                $table->index(
                    ['application_id', 'conversation_type'],
                    $this->applicationConversationTypeIndex
                );
            });
        }

        if (
            Schema::hasColumn('intern_chat_conversations', 'binome_candidate_id') &&
            !$this->indexExists('intern_chat_conversations', $this->binomeCandidateIndex)
        ) {
            Schema::table('intern_chat_conversations', function (Blueprint $table) {
                $table->index('binome_candidate_id', $this->binomeCandidateIndex);
            });
        }

        if (
            Schema::hasColumn('intern_chat_conversations', 'binome_candidate_id') &&
            !$this->foreignKeyExists('intern_chat_conversations', $this->binomeCandidateForeign)
        ) {
            Schema::table('intern_chat_conversations', function (Blueprint $table) {
                $table->foreign('binome_candidate_id', $this->binomeCandidateForeign)
                    ->references('id')
                    ->on('candidates')
                    ->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('intern_chat_conversations', function (Blueprint $table) {
            if ($this->foreignKeyExists('intern_chat_conversations', $this->binomeCandidateForeign)) {
                $table->dropForeign($this->binomeCandidateForeign);
            }
            if ($this->indexExists('intern_chat_conversations', $this->applicationConversationTypeIndex)) {
                $table->dropIndex($this->applicationConversationTypeIndex);
            }
            if ($this->indexExists('intern_chat_conversations', $this->binomeCandidateIndex)) {
                $table->dropIndex($this->binomeCandidateIndex);
            }
            if (Schema::hasColumn('intern_chat_conversations', 'binome_candidate_id')) {
                $table->dropColumn('binome_candidate_id');
            }
            if (Schema::hasColumn('intern_chat_conversations', 'conversation_type')) {
                $table->dropColumn('conversation_type');
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

    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        return DB::table('information_schema.table_constraints')
            ->where('table_schema', 'public')
            ->where('table_name', $table)
            ->where('constraint_type', 'FOREIGN KEY')
            ->where('constraint_name', $constraintName)
            ->exists();
    }
};
