<?php

use App\Models\Program;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Which year levels each program offers. Backfilled so every existing program
     * keeps all current year levels (preserving the previous behaviour).
     */
    public function up(): void
    {
        Schema::create('program_year_level', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Program::class)->constrained()->cascadeOnDelete();
            $table->foreignId('year_level_id')->constrained('year_levels')->cascadeOnDelete();
            $table->unique(['program_id', 'year_level_id']);
        });

        $programIds = DB::table('programs')->pluck('id');
        $levelIds = DB::table('year_levels')->pluck('id');

        $rows = [];
        foreach ($programIds as $programId) {
            foreach ($levelIds as $levelId) {
                $rows[] = ['program_id' => $programId, 'year_level_id' => $levelId];
            }
        }

        if ($rows !== []) {
            DB::table('program_year_level')->insert($rows);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('program_year_level');
    }
};
