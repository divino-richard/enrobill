<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Digital payment channels (e-wallets) students can pay to, each with an
     * admin-uploaded QR code. Seeded with GCash and Maya.
     */
    public function up(): void
    {
        Schema::create('payment_channels', function (Blueprint $table) {
            $table->id();
            // Matches the payment method code (gcash, maya).
            $table->string('code')->unique();
            $table->string('label');
            $table->string('account_name')->nullable();
            $table->string('account_number')->nullable();
            // S3 key of the uploaded QR image.
            $table->string('qr_key')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        $now = now();
        foreach ([['gcash', 'GCash'], ['maya', 'Maya']] as $i => [$code, $label]) {
            DB::table('payment_channels')->insert([
                'code' => $code,
                'label' => $label,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_channels');
    }
};
