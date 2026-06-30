<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            if (Schema::hasColumn('school_years', 'current_semester')) {
                $table->dropColumn('current_semester');
            }
        });

        Schema::table('applications', function (Blueprint $table) {
            if (Schema::hasColumn('applications', 'semester')) {
                $table->dropColumn('semester');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            if (! Schema::hasColumn('school_years', 'current_semester')) {
                $table->string('current_semester')->nullable();
            }
        });

        Schema::table('applications', function (Blueprint $table) {
            if (! Schema::hasColumn('applications', 'semester')) {
                $table->string('semester')->nullable()->index();
            }
        });
    }
};
