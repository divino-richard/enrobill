<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A student's request to move to a different track/strand, and the
     * registrar's decision on it. Approving one actually updates the
     * enrollment/student's program — see App\Actions\ExecuteProgramTransfer.
     */
    public function up(): void
    {
        Schema::create('program_transfer_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $table->string('from_program_code');
            $table->string('to_program_code');
            // Snapshot of the enrollment's school year label (e.g. "2026-2027").
            $table->string('school_year');
            $table->text('reason');
            $table->string('status')->default('pending'); // pending | approved | rejected
            $table->text('decision_note')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->index('student_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_transfer_requests');
    }
};
