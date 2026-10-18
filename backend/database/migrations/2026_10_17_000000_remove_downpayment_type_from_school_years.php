<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A percentage cannot be converted to one peso amount across different bills.
        if (DB::table('school_years')->whereNotNull('downpayment_type')->where('downpayment_type', '!=', 'fixed')->exists()) {
            throw new RuntimeException('Set an explicit fixed downpayment amount for every school year before removing downpayment types.');
        }

        Schema::table('school_years', function (Blueprint $table) {
            $table->dropColumn('downpayment_type');
        });
    }

    public function down(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            $table->string('downpayment_type')->nullable()->default('fixed');
        });
    }
};
