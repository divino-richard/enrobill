<?php

use App\Models\Section;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Sections created before the 20-student standard defaulted to 40. Bring
     * those onto the new default; sections given a custom capacity are left as-is.
     */
    public function up(): void
    {
        DB::table('sections')
            ->where('capacity', 40)
            ->update(['capacity' => Section::DEFAULT_CAPACITY]);
    }

    public function down(): void
    {
        DB::table('sections')
            ->where('capacity', Section::DEFAULT_CAPACITY)
            ->update(['capacity' => 40]);
    }
};
