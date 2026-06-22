<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fees are now a single global per-school-year schedule (school_year_fees).
     * The per-program fee catalog and the per-term fee structures are obsolete.
     */
    public function up(): void
    {
        Schema::dropIfExists('fee_structure_items');
        Schema::dropIfExists('fee_structures');
        Schema::dropIfExists('program_fee_items');
    }

    public function down(): void
    {
        Schema::create('fee_structures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('term_id')->constrained('school_years')->cascadeOnDelete();
            $table->string('track');
            $table->string('year_level');
            $table->timestamps();
            $table->unique(['term_id', 'track', 'year_level']);
        });

        Schema::create('fee_structure_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fee_structure_id')->constrained('fee_structures')->cascadeOnDelete();
            $table->string('name');
            $table->decimal('amount', 10, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('program_fee_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained('programs')->cascadeOnDelete();
            $table->string('name');
            $table->string('year_level')->nullable();
            $table->decimal('amount', 10, 2)->nullable();
            $table->timestamps();
            $table->unique(['program_id', 'name', 'year_level']);
        });
    }
};
