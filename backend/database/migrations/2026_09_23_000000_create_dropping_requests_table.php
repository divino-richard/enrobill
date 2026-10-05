<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dropping_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enrollment_id')->constrained()->restrictOnDelete();
            $table->foreignId('student_id')->constrained()->restrictOnDelete();
            // Nullable unique slot guarantees only one open request per enrollment.
            $table->foreignId('active_enrollment_id')->nullable()->unique()->constrained('enrollments')->restrictOnDelete();
            $table->string('status')->default('draft')->index();
            $table->text('reason')->nullable();
            $table->json('snapshot');
            $table->json('submissions');
            $table->json('events');
            $table->json('checklist')->nullable();
            $table->foreignId('documents_verified_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('documents_verified_at')->nullable();
            $table->string('finance_outcome')->nullable();
            $table->text('finance_remarks')->nullable();
            $table->decimal('reviewed_balance', 12, 2)->nullable();
            $table->foreignId('finance_reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('finance_reviewed_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->date('effective_date')->nullable();
            $table->text('final_remarks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dropping_requests');
    }
};
