<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Split the single `is_open` flag into two independent concepts:
     *  - `is_active`: the term the system operates on (bills, portal, dashboard).
     *  - `enrollment_open`: whether new applications are being accepted.
     */
    public function up(): void
    {
        Schema::table('terms', function (Blueprint $table) {
            $table->renameColumn('is_open', 'is_active');
        });

        Schema::table('terms', function (Blueprint $table) {
            $table->boolean('enrollment_open')->default(false)->after('is_active');
        });

        // Preserve prior behavior: the active term also had enrollment open.
        DB::table('terms')->where('is_active', true)->update(['enrollment_open' => true]);
    }

    public function down(): void
    {
        Schema::table('terms', function (Blueprint $table) {
            $table->dropColumn('enrollment_open');
        });

        Schema::table('terms', function (Blueprint $table) {
            $table->renameColumn('is_active', 'is_open');
        });
    }
};
