<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Progression now follows the school year's end date automatically, with the
     * admin able to override it. The column becomes a nullable manual override:
     *   null  → follow the schedule (open once the year has ended)
     *   true  → force open  (manual wins)
     *   false → force closed (manual wins)
     */
    public function up(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            $table->boolean('progression_open')->nullable()->default(null)->change();
        });

        // Reset existing flags so every year starts out following the schedule.
        DB::table('school_years')->update(['progression_open' => null]);
    }

    public function down(): void
    {
        DB::table('school_years')->whereNull('progression_open')->update(['progression_open' => false]);

        Schema::table('school_years', function (Blueprint $table) {
            $table->boolean('progression_open')->default(false)->change();
        });
    }
};
