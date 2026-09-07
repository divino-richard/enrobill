<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incentive_awards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            // Null only while a successful referrer's upcoming Grade 12 enrollment
            // has not yet been materialized.
            $table->foreignId('enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->foreignId('freebie_id')->nullable()->constrained('freebies')->nullOnDelete();
            $table->foreignId('referral_id')->nullable()->constrained('referrals')->nullOnDelete();
            // Multiple independently-earned awards share one zero-tuition ledger
            // adjustment on a bill.
            $table->foreignId('bill_adjustment_id')->nullable()
                ->constrained('bill_adjustments')->nullOnDelete();
            $table->string('type')->index(); // early_enrollment | referral
            $table->string('beneficiary')->index();
            $table->string('status')->default('pending')->index();
            $table->timestamp('qualified_at')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            // Threshold is fixed at one: a student can earn each incentive type at
            // most once in a school year, even after multiple successful referrals.
            $table->unique(['school_year_id', 'student_id', 'type']);
            $table->index(['enrollment_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incentive_awards');
    }
};
