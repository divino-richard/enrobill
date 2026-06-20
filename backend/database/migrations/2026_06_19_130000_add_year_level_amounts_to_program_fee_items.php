<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Default fee items now carry a separate amount per year level so a single
     * program template can price Grade 11 and Grade 12 differently. A null amount
     * means the item isn't charged for that level.
     */
    public function up(): void
    {
        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->decimal('amount_grade_11', 10, 2)->nullable()->after('name');
            $table->decimal('amount_grade_12', 10, 2)->nullable()->after('amount_grade_11');
        });

        // Existing single amount applied to every level — carry it into both.
        DB::table('program_fee_items')->update([
            'amount_grade_11' => DB::raw('amount'),
            'amount_grade_12' => DB::raw('amount'),
        ]);

        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->dropColumn('amount');
        });
    }

    public function down(): void
    {
        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->decimal('amount', 10, 2)->default(0)->after('name');
        });

        DB::table('program_fee_items')->update([
            'amount' => DB::raw('COALESCE(amount_grade_11, amount_grade_12, 0)'),
        ]);

        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->dropColumn(['amount_grade_11', 'amount_grade_12']);
        });
    }
};
