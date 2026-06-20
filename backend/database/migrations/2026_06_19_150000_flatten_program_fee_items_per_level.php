<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Move from fixed per-level amount columns to one row per (item, year level),
     * so program fee items support any dynamic set of year levels. A row exists
     * only for levels the item is actually charged for.
     */
    public function up(): void
    {
        $existing = DB::table('program_fee_items')->get();

        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->string('year_level')->nullable()->after('name');
            $table->decimal('amount', 10, 2)->nullable()->after('year_level');
        });

        DB::table('program_fee_items')->delete();

        $rows = [];
        foreach ($existing as $item) {
            $amounts = ['grade_11' => $item->amount_grade_11, 'grade_12' => $item->amount_grade_12];
            foreach ($amounts as $level => $amount) {
                if ($amount !== null) {
                    $rows[] = [
                        'program_id' => $item->program_id,
                        'name' => $item->name,
                        'year_level' => $level,
                        'amount' => $amount,
                        'created_at' => $item->created_at,
                        'updated_at' => $item->updated_at,
                    ];
                }
            }
        }

        if ($rows !== []) {
            DB::table('program_fee_items')->insert($rows);
        }

        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->dropColumn(['amount_grade_11', 'amount_grade_12']);
            $table->unique(['program_id', 'name', 'year_level']);
        });
    }

    public function down(): void
    {
        $existing = DB::table('program_fee_items')->get();

        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->dropUnique(['program_id', 'name', 'year_level']);
            $table->decimal('amount_grade_11', 10, 2)->nullable()->after('name');
            $table->decimal('amount_grade_12', 10, 2)->nullable()->after('amount_grade_11');
        });

        DB::table('program_fee_items')->delete();

        $byItem = [];
        foreach ($existing as $row) {
            $key = $row->program_id.'|'.$row->name;
            $byItem[$key] ??= [
                'program_id' => $row->program_id,
                'name' => $row->name,
                'amount_grade_11' => null,
                'amount_grade_12' => null,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ];
            if ($row->year_level === 'grade_11') {
                $byItem[$key]['amount_grade_11'] = $row->amount;
            } elseif ($row->year_level === 'grade_12') {
                $byItem[$key]['amount_grade_12'] = $row->amount;
            }
        }

        if ($byItem !== []) {
            DB::table('program_fee_items')->insert(array_values($byItem));
        }

        Schema::table('program_fee_items', function (Blueprint $table) {
            $table->dropColumn(['year_level', 'amount']);
        });
    }
};
