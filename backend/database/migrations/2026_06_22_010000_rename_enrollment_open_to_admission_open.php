<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The flag gates whether new applications are accepted — that's the
     * admission window, not "enrollment" (which here means an admitted student's
     * per-term record). Rename for clarity.
     */
    public function up(): void
    {
        Schema::table('terms', function (Blueprint $table) {
            $table->renameColumn('enrollment_open', 'admission_open');
        });
    }

    public function down(): void
    {
        Schema::table('terms', function (Blueprint $table) {
            $table->renameColumn('admission_open', 'enrollment_open');
        });
    }
};
