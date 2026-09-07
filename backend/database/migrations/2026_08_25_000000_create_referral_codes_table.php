<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referral_codes', function (Blueprint $table) {
            $table->id();
            // The upcoming school year this reusable code may be claimed in.
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnDelete();
            $table->foreignId('referrer_student_id')->constrained('students')->cascadeOnDelete();
            // Snapshot the prior-year Grade 11 enrollment that qualified the owner
            // to receive a code. It is historical evidence, not the rewarded Grade
            // 12 enrollment (which may not exist yet).
            $table->foreignId('qualifying_enrollment_id')->nullable()
                ->constrained('enrollments')->nullOnDelete();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            // Random and globally unique: the value reveals neither a student id nor
            // the school year, while lookup remains unambiguous.
            $table->string('code', 32)->unique();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            // One stable, reusable code per referrer for an upcoming school year.
            $table->unique(['school_year_id', 'referrer_student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_codes');
    }
};
