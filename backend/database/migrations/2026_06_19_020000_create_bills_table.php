<?php

use App\Models\Bill;
use App\Models\FeeStructure;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Student::class)->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Term::class)->constrained()->cascadeOnDelete();
            // The fee structure this was generated from (kept for traceability).
            $table->foreignIdFor(FeeStructure::class)->nullable()->constrained()->nullOnDelete();
            $table->decimal('total', 10, 2)->default(0);
            $table->decimal('amount_paid', 10, 2)->default(0);
            $table->string('status')->default('unpaid')->index();
            $table->timestamps();

            // One bill per student per term.
            $table->unique(['student_id', 'term_id']);
        });

        Schema::create('bill_items', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Bill::class)->constrained()->cascadeOnDelete();
            // Snapshot of the fee item at the time of billing.
            $table->string('name');
            $table->decimal('amount', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_items');
        Schema::dropIfExists('bills');
    }
};
