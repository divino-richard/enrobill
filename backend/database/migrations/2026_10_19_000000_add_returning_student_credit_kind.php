<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_credits', function (Blueprint $table) {
            $table->string('kind')->default('excess_payment');
            $table->unique(['source_bill_id', 'kind']);
        });
        Schema::table('student_credits', fn (Blueprint $table) => $table->dropUnique(['source_bill_id']));
    }

    public function down(): void
    {
        if (DB::table('student_credits')->where('kind', '!=', 'excess_payment')->exists()) {
            throw new RuntimeException('Returning student credits must be retained. This migration cannot be rolled back after credits have been issued.');
        }
        Schema::table('student_credits', fn (Blueprint $table) => $table->unique('source_bill_id'));
        Schema::table('student_credits', function (Blueprint $table) {
            $table->dropUnique(['source_bill_id', 'kind']);
            $table->dropColumn('kind');
        });
    }
};
