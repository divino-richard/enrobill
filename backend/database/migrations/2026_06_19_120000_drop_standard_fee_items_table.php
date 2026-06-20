<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The global standard fee items have been superseded by per-program default
     * fee items (their values were carried into each program first).
     */
    public function up(): void
    {
        Schema::dropIfExists('standard_fee_items');
    }

    public function down(): void
    {
        Schema::create('standard_fee_items', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->decimal('amount', 10, 2)->default(0);
            $table->timestamps();
        });
    }
};
