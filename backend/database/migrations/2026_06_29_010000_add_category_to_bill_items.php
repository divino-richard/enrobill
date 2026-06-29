<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bill_items', function (Blueprint $table) {
            // Snapshot of the fee's category at billing time, so the student's
            // bill can be grouped by the Schedule of Fees sections.
            $table->string('category')->default('other')->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('bill_items', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
