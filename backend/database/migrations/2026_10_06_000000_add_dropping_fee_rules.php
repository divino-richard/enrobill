<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dropping_policies', fn (Blueprint $table) => $table->json('fee_rules')->nullable());
        // Snapshot identity survives catalog deletion; do not cascade or null it.
        Schema::table('bill_items', fn (Blueprint $table) => $table->unsignedBigInteger('source_fee_id')->nullable());
    }

    public function down(): void
    {
        Schema::table('dropping_policies', fn (Blueprint $table) => $table->dropColumn('fee_rules'));
        Schema::table('bill_items', fn (Blueprint $table) => $table->dropColumn('source_fee_id'));
    }
};
