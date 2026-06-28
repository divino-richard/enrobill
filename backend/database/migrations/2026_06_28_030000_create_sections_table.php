<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Class sections — a managed catalog scoped to a school year, program and
     * grade. Enrolled students are placed into a section (auto on enroll, with
     * admin able to move them).
     */
    public function up(): void
    {
        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnDelete();
            // Program code (matches programs.code / a student's track_or_strand).
            $table->string('program');
            $table->string('year_level');
            $table->string('name');
            $table->unsignedInteger('capacity')->default(40);
            $table->timestamps();

            // One section name per program + grade within a school year.
            $table->unique(['school_year_id', 'program', 'year_level', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sections');
    }
};
