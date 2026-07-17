<?php

use App\Models\Discount;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The voucher granted to a student for this school year. Chosen by the admin
     * when the application is accepted (and carried forward on progression), then
     * applied automatically when the cashier generates the bill.
     */
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->foreignIdFor(Discount::class)
                ->nullable()
                ->after('year_level')
                ->constrained()
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('discount_id');
        });
    }
};
