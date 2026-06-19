<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('standard_fee_items', function (Blueprint $table) {
            $table->id();
            // The default catalog of fee items new fee structures are seeded with.
            $table->string('name')->unique();
            $table->decimal('amount', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('standard_fee_items');
    }
};
