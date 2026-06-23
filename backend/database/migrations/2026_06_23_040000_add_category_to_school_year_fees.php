<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Group fee items by the section they belong to on the official Schedule of
     * Fees: `tuition`, `miscellaneous`, or `other`. Lets the schedule render (and
     * subtotal) the same breakdown as the printed sheet.
     */
    public function up(): void
    {
        Schema::table('school_year_fees', function (Blueprint $table) {
            $table->string('category')->default('other')->after('year_level'); // tuition | miscellaneous | other
        });
    }

    public function down(): void
    {
        Schema::table('school_year_fees', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
