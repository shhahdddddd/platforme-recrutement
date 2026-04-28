<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('COMPANY', 'ADMIN', 'CANDIDATE'))");

        // Optionally map existing roles to the new ones if needed
        DB::table('users')->where('role', 'recruiter')->update(['role' => 'COMPANY']);
        DB::table('users')->where('role', 'candidate')->update(['role' => 'CANDIDATE']);
        DB::table('users')->where('role', 'company')->update(['role' => 'COMPANY']);
        DB::table('users')->where('role', 'admin')->update(['role' => 'ADMIN']);
        DB::table('users')->where('role', 'client')->update(['role' => 'COMPANY']);
    }

    public function down()
    {
        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('candidate', 'recruiter', 'client'))");
    }
};
