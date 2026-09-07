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

        if (Schema::hasColumn('applications', 'semester')) {
            // SQLite cannot rebuild the table for a dropped column while an
            // index still references that column. Dropping the known index
            // explicitly is also safe for MySQL/PostgreSQL fresh installs.
            Schema::table('applications', function (Blueprint $table) {
                $table->dropIndex(['semester']);
            });
            Schema::table('applications', function (Blueprint $table) {
                $table->dropColumn('semester');
            });
        }
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
