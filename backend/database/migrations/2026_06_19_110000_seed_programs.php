<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Seed the program catalog from the codes that were previously hardcoded,
     * preserving them so existing applications/students/fee structures resolve.
     * Any existing global standard fee items are carried into every program.
     */
    public function up(): void
    {
        $now = now();

        $programs = [
            ['code' => 'stem', 'name' => 'STEM (Science, Technology, Engineering, Mathematics)', 'category' => 'Academic Track'],
            ['code' => 'assh', 'name' => 'ASSH (Humanities & Social Sciences)', 'category' => 'Academic Track'],
            ['code' => 'abm', 'name' => 'BE-ABM (Accounting, Business & Management)', 'category' => 'Academic Track'],
            ['code' => 'gas', 'name' => 'GAS (General Academic Strand)', 'category' => 'Academic Track'],
            ['code' => 'creative_arts', 'name' => 'Creative Arts', 'category' => 'TechVoc Track'],
            ['code' => 'hospitality', 'name' => 'Hospitality', 'category' => 'TechVoc Track'],
            ['code' => 'ict', 'name' => 'ICT (Information & Communications Technology)', 'category' => 'TechVoc Track'],
        ];

        foreach ($programs as $index => $program) {
            DB::table('programs')->updateOrInsert(
                ['code' => $program['code']],
                [
                    'name' => $program['name'],
                    'category' => $program['category'],
                    'sort_order' => $index + 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }

        // Carry over any existing global standard fee items as each program's
        // starting default items.
        $standard = Schema::hasTable('standard_fee_items')
            ? DB::table('standard_fee_items')->orderBy('id')->get(['name', 'amount'])
            : collect();

        if ($standard->isNotEmpty()) {
            $programIds = DB::table('programs')->pluck('id');
            $rows = [];
            foreach ($programIds as $programId) {
                foreach ($standard as $item) {
                    $rows[] = [
                        'program_id' => $programId,
                        'name' => $item->name,
                        'amount' => $item->amount,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
            if ($rows !== []) {
                DB::table('program_fee_items')->insert($rows);
            }
        }
    }

    public function down(): void
    {
        DB::table('programs')->truncate();
    }
};
