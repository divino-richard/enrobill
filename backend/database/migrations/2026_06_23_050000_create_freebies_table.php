<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-school-year promos that, together with a voucher, zero a student's
     * remaining balance ("Zero Tuition Balance"). Eligibility is rule-based by
     * `type`: `early_enrollment` uses the [starts_on, ends_on] window;
     * `referral` (future) uses `min_referrals`.
     */
    public function up(): void
    {
        Schema::create('freebies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnDelete();
            $table->string('type'); // early_enrollment | referral
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->unsignedInteger('min_referrals')->nullable();
            $table->timestamps();

            $table->unique(['school_year_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('freebies');
    }
};
