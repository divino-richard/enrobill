<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Year levels are fixed to SHS (Grade 11 / Grade 12) for now, so the
     * admin-managed catalog and per-program assignment are removed. Year level
     * codes remain stored as plain strings on bills/fee structures/etc.
     */
    public function up(): void
    {
        Schema::dropIfExists('program_year_level');
        Schema::dropIfExists('year_levels');
    }

    public function down(): void
    {
        Schema::create('year_levels', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('program_year_level', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->foreignId('year_level_id')->constrained()->cascadeOnDelete();
            $table->unique(['program_id', 'year_level_id']);
        });
    }
};
