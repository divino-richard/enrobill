<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Program categories are now a fixed selection: "Academic Track" / "TVL
     * Track". Normalize the previously-seeded "TechVoc Track" label.
     */
    public function up(): void
    {
        DB::table('programs')->where('category', 'TechVoc Track')->update(['category' => 'TVL Track']);
    }

    public function down(): void
    {
        DB::table('programs')->where('category', 'TVL Track')->update(['category' => 'TechVoc Track']);
    }
};
