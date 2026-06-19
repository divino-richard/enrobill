<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discounts', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            // What kind of credit this is, for reporting: discount, scholarship, voucher.
            $table->string('category');
            // How the credit is computed: fixed (peso amount) or percentage.
            $table->string('type');
            // Peso amount when fixed; percent (0-100) when percentage.
            $table->decimal('value', 10, 2)->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discounts');
    }
};
