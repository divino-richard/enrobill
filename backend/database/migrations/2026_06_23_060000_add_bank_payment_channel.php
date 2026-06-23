<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add a Bank Transfer payment channel alongside GCash and Maya. Admins fill in
     * the account details (and optional QR) on the Payment Methods page.
     */
    public function up(): void
    {
        DB::table('payment_channels')->updateOrInsert(
            ['code' => 'bank'],
            ['label' => 'Bank Transfer', 'is_active' => true, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    public function down(): void
    {
        DB::table('payment_channels')->where('code', 'bank')->delete();
    }
};
