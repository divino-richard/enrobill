<?php

use App\Models\Bill;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bill_installments', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Bill::class)->constrained()->cascadeOnDelete();
            // Order the installment falls due in (1 = down payment).
            $table->unsignedInteger('sequence');
            $table->string('label');
            $table->decimal('amount', 10, 2)->default(0);
            $table->date('due_date');
            $table->timestamps();

            $table->unique(['bill_id', 'sequence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_installments');
    }
};
