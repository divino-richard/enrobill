<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-semester clearance/grades review that gates the year-end promote/graduate
     * decision. One row per (student, school year, semester).
     */
    public function up(): void
    {
        Schema::create('semester_standings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_year_id')->constrained()->cascadeOnDelete();
            $table->string('semester'); // first | second
            $table->boolean('clearance_cleared')->default(false);
            $table->boolean('grades_passed')->default(false);
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'school_year_id', 'semester']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('semester_standings');
    }
};
