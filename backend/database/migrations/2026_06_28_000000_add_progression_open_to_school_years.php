<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whether year-end progression (promote / retain / graduate) is enabled for
     * a school year. Off by default so the admin must deliberately open it, the
     * same way admissions work.
     */
    public function up(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            $table->boolean('progression_open')->default(false)->after('admission_open');
        });
    }

    public function down(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            $table->dropColumn('progression_open');
        });
    }
};
