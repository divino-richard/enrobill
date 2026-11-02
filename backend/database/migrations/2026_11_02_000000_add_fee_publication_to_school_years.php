<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            $table->timestamp('fees_published_at')->nullable();
        });

        // Existing schedules have not been reviewed through the publication flow.
        // Keep their fees and historical bills, but require review before admissions.
        DB::table('school_years')->update(['admission_open' => false]);
    }

    public function down(): void
    {
        Schema::table('school_years', function (Blueprint $table) {
            $table->dropColumn('fees_published_at');
        });
    }
};
