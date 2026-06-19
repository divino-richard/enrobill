<?php

use App\Models\Bill;
use App\Models\Discount;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bill_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Bill::class)->constrained()->cascadeOnDelete();
            // The catalog discount this came from (kept for reporting/traceability).
            $table->foreignIdFor(Discount::class)->nullable()->constrained()->nullOnDelete();
            // Snapshot of the discount at the time it was applied.
            $table->string('label');
            $table->string('type');
            $table->decimal('value', 10, 2)->default(0);
            // The resolved peso credit this adjustment removes from the bill.
            $table->decimal('amount', 10, 2)->default(0);
            $table->timestamps();

            // A given catalog discount applies at most once per bill.
            $table->unique(['bill_id', 'discount_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_adjustments');
    }
};
