<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the foreign key constraint that references admins table
        // since admin users are stored in users table with role='admin'
        if (Schema::hasTable('urgent_contacts')) {
            DB::statement('ALTER TABLE urgent_contacts DROP CONSTRAINT IF EXISTS urgent_contacts_resolved_by_foreign');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('urgent_contacts')) {
            DB::statement("
                ALTER TABLE urgent_contacts
                ADD CONSTRAINT urgent_contacts_resolved_by_foreign
                FOREIGN KEY (resolved_by) REFERENCES admins(id) ON DELETE SET NULL
            ");
        }
    }
};
