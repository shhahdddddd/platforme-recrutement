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
        DB::statement("DROP TABLE IF EXISTS company_subscriptions CASCADE");
        DB::statement("DROP TYPE IF EXISTS payment_method_type CASCADE");
        DB::statement("CREATE TYPE payment_method_type AS ENUM ('Cash', 'Bank Transfer', 'Cheque', 'Online Payment')");

        DB::unprepared("
            CREATE TABLE company_subscriptions (
                id SERIAL PRIMARY KEY,
                company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                payment_method payment_method_type, 
                notes TEXT,
                created_by INT REFERENCES admins(id),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT chk_subscription_dates CHECK (end_date > start_date)
            );
        ");
    }

    public function down()
    {
        Schema::dropIfExists('company_subscriptions');
        DB::statement("DROP TYPE IF EXISTS payment_method_type CASCADE");
    }
};
