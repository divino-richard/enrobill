<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Enrollment and billing are now keyed by school year (one each per student
     * per year). Re-point both `term_id` columns to `school_year_id`, add the
     * per-enrollment `no_downpayment` flag (private-school graduates), and drop
     * the bill's fee-structure link and full/installment `payment_option` (every
     * bill is installment now).
     *
     * Note: the composite unique (student_id, term_id) also backs the student_id
     * foreign key (leftmost prefix), so that FK must be dropped before the index
     * can be removed, then re-added.
     */
    public function up(): void
    {
        // --- enrollments -----------------------------------------------------
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->dropForeign(['term_id']);
            $table->dropUnique(['student_id', 'term_id']);
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->renameColumn('term_id', 'school_year_id');
            $table->boolean('no_downpayment')->default(false)->after('year_level');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();
            $table->foreign('school_year_id')->references('id')->on('school_years')->cascadeOnDelete();
            $table->unique(['student_id', 'school_year_id']);
        });

        // --- bills -----------------------------------------------------------
        Schema::table('bills', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->dropForeign(['term_id']);
            $table->dropForeign(['fee_structure_id']);
            $table->dropUnique(['student_id', 'term_id']);
            $table->dropColumn(['fee_structure_id', 'payment_option']);
        });

        Schema::table('bills', function (Blueprint $table) {
            $table->renameColumn('term_id', 'school_year_id');
        });

        Schema::table('bills', function (Blueprint $table) {
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();
            $table->foreign('school_year_id')->references('id')->on('school_years')->cascadeOnDelete();
            $table->unique(['student_id', 'school_year_id']);
        });
    }

    public function down(): void
    {
        Schema::table('bills', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->dropForeign(['school_year_id']);
            $table->dropUnique(['student_id', 'school_year_id']);
        });

        Schema::table('bills', function (Blueprint $table) {
            $table->renameColumn('school_year_id', 'term_id');
            $table->foreignId('fee_structure_id')->nullable()->after('term_id');
            $table->string('payment_option')->nullable()->after('status');
        });

        Schema::table('bills', function (Blueprint $table) {
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();
            $table->foreign('term_id')->references('id')->on('school_years')->cascadeOnDelete();
            $table->unique(['student_id', 'term_id']);
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
            $table->dropForeign(['school_year_id']);
            $table->dropUnique(['student_id', 'school_year_id']);
            $table->dropColumn('no_downpayment');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->renameColumn('school_year_id', 'term_id');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->foreign('student_id')->references('id')->on('students')->cascadeOnDelete();
            $table->foreign('term_id')->references('id')->on('school_years')->cascadeOnDelete();
            $table->unique(['student_id', 'term_id']);
        });
    }
};
