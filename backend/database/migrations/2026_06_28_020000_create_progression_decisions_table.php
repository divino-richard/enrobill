<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per student per year-end decision. This is the source of truth for
     * a student's outcome on the year that is ending — decoupled from the next
     * year, which only matters when a promote/retain decision is materialized into
     * an actual enrollment.
     */
    public function up(): void
    {
        Schema::create('progression_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_school_year_id')->constrained('school_years')->cascadeOnDelete();
            // promote | retain | graduate
            $table->string('decision');
            $table->string('from_year_level')->nullable();
            // promote = next grade, retain = same grade, graduate = null
            $table->string('to_year_level')->nullable();
            // Set when a promote/retain decision is enrolled into the next year.
            $table->foreignId('to_school_year_id')->nullable()->constrained('school_years')->nullOnDelete();
            $table->foreignId('to_enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('materialized_at')->nullable();
            $table->timestamps();

            // At most one decision per student for a given ending year.
            $table->unique(['student_id', 'from_school_year_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('progression_decisions');
    }
};
