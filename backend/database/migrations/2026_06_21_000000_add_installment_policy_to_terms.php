<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-term installment policy: whether installments are offered, the required
     * downpayment, and how many equal monthly installments cover the remainder.
     * Students pick full vs installment; the schedule is generated from this.
     */
    public function up(): void
    {
        Schema::table('terms', function (Blueprint $table) {
            $table->boolean('installments_enabled')->default(false)->after('is_open');
            $table->string('downpayment_type')->nullable()->after('installments_enabled');
            $table->decimal('downpayment_value', 10, 2)->nullable()->after('downpayment_type');
            $table->unsignedInteger('installment_count')->nullable()->after('downpayment_value');
        });

        Schema::table('bills', function (Blueprint $table) {
            // The student's chosen scheme: full | installment (null = undecided).
            $table->string('payment_option')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('terms', function (Blueprint $table) {
            $table->dropColumn([
                'installments_enabled', 'downpayment_type', 'downpayment_value', 'installment_count',
            ]);
        });

        Schema::table('bills', function (Blueprint $table) {
            $table->dropColumn('payment_option');
        });
    }
};
