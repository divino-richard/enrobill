<?php

use App\Models\Bill;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Bill::class)->constrained()->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            // How the student paid: cash, gcash, bank, etc.
            $table->string('method')->default('cash');
            // Optional OR/receipt or transaction reference.
            $table->string('reference')->nullable();
            $table->date('paid_at');
            // The staff member who recorded the payment.
            $table->foreignIdFor(User::class, 'recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
