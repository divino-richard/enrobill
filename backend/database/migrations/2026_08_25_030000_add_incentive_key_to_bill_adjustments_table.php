<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bill_adjustments', function (Blueprint $table) {
            $table->string('incentive_key')->nullable()->after('discount_id');
            // SQL unique indexes permit multiple nulls, so ordinary adjustments are
            // unaffected while each named incentive may appear once per bill.
            $table->unique(['bill_id', 'incentive_key']);
        });
    }

    public function down(): void
    {
        Schema::table('bill_adjustments', function (Blueprint $table) {
            $table->dropUnique(['bill_id', 'incentive_key']);
            $table->dropColumn('incentive_key');
        });
    }
};
