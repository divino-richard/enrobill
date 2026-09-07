<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnDelete();
            $table->foreignId('referral_code_id')->constrained('referral_codes')->cascadeOnDelete();
            // Denormalized from the code so the business relationship remains easy
            // to audit even if code issuance rules evolve later.
            $table->foreignId('referrer_student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('application_id')->unique()->constrained('applications')->cascadeOnDelete();
            $table->foreignId('referred_student_id')->nullable()->constrained('students')->nullOnDelete();
            // The target-year enrollments for the two beneficiaries. The Grade 12
            // one is intentionally nullable until progression is materialized.
            $table->foreignId('referrer_enrollment_id')->nullable()->constrained('enrollments')->nullOnDelete();
            $table->foreignId('referred_enrollment_id')->nullable()->unique()
                ->constrained('enrollments')->nullOnDelete();
            $table->string('status')->default('claimed')->index();
            $table->foreignId('claimed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('successful_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['school_year_id', 'referrer_student_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referrals');
    }
};
