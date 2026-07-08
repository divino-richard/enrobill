<?php

use App\Models\Section;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Bump the standard section size from 20 to 30 students. Sections still on
     * the old default are moved onto the new one; sections given a custom
     * capacity are left as-is.
     */
    public function up(): void
    {
        DB::table('sections')
            ->where('capacity', 20)
            ->update(['capacity' => Section::DEFAULT_CAPACITY]);
    }

    public function down(): void
    {
        DB::table('sections')
            ->where('capacity', Section::DEFAULT_CAPACITY)
            ->update(['capacity' => 20]);
    }
};
