<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->string('dropping_category')->nullable();
            $table->foreignId('returning_from_enrollment_id')->nullable()->constrained('enrollments')->restrictOnDelete();
        });
        Schema::table('school_year_fees', fn (Blueprint $table) => $table->string('dropping_component')->nullable());
        Schema::table('bill_items', fn (Blueprint $table) => $table->string('dropping_component')->nullable());
        Schema::create('dropping_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_year_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->boolean('enabled')->default(false);
            $table->json('periods');
            $table->json('formulas');
            $table->timestamps();
            $table->unique(['school_year_id', 'version']);
        });
        Schema::create('dropping_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('request_id')->unique()->constrained('dropping_requests')->restrictOnDelete();
            $table->foreignId('enrollment_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('bill_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('policy_id')->constrained('dropping_policies')->restrictOnDelete();
            $table->foreignId('approved_by')->constrained('users')->restrictOnDelete();
            $table->decimal('final_charge', 12, 2);
            $table->json('snapshot');
            $table->timestamps();
        });
        Schema::create('student_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            $table->foreignId('source_bill_id')->unique()->constrained('bills')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->foreignId('issued_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
        Schema::create('student_credit_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_id')->constrained('student_credits')->restrictOnDelete();
            $table->foreignId('bill_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->decimal('released_amount', 12, 2)->default(0);
            $table->foreignId('allocated_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
        Schema::create('payment_arrangements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->unique()->constrained()->restrictOnDelete();
            $table->text('remarks');
            $table->foreignId('approved_by')->constrained('users')->restrictOnDelete();
            $table->decimal('starting_paid', 12, 2)->default(0);
            $table->json('installments');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_arrangements');
        Schema::dropIfExists('student_credit_allocations');
        Schema::dropIfExists('student_credits');
        Schema::dropIfExists('dropping_assessments');
        Schema::dropIfExists('dropping_policies');
        Schema::table('bill_items', fn (Blueprint $table) => $table->dropColumn('dropping_component'));
        Schema::table('school_year_fees', fn (Blueprint $table) => $table->dropColumn('dropping_component'));
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('returning_from_enrollment_id');
            $table->dropColumn('dropping_category');
        });
    }
};
