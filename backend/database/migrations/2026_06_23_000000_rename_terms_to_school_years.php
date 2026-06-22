<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The academic period is now the school year. A "term" row becomes a school
     * year row; the old `semester` column becomes a lightweight `current_semester`
     * pointer that simply tracks progress within the year. There is one row per
     * school year now. Installments are always on, so the per-term toggle is dropped.
     */
    public function up(): void
    {
        Schema::rename('terms', 'school_years');

        // Drop the old (school_year, semester) uniqueness — index names persist
        // across a table rename, so reference it by its original name.
        Schema::table('school_years', function (Blueprint $table) {
            $table->dropUnique('terms_school_year_semester_unique');
        });

        Schema::table('school_years', function (Blueprint $table) {
            $table->renameColumn('semester', 'current_semester');
        });

        Schema::table('school_years', function (Blueprint $table) {
            $table->dropColumn('installments_enabled');
            $table->unique('school_year');
        });
    }

    public function down(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            $table->dropUnique(['school_year']);
            $table->boolean('installments_enabled')->default(false);
        });

        Schema::table('school_years', function (Blueprint $table) {
            $table->renameColumn('current_semester', 'semester');
        });

        Schema::table('school_years', function (Blueprint $table) {
            $table->unique(['school_year', 'semester']);
        });

        Schema::rename('school_years', 'terms');
    }
};
