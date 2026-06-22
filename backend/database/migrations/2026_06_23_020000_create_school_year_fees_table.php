<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The global, per-school-year fee schedule, keyed by year level. Replaces the
     * per-program fee catalog and the per-term fee structures. `year_level` may be
     * `all` (applies to every level), `grade_11`, or `grade_12`. `type` is
     * `default` (base fees) or `add_on` (extras, e.g. Grade 12 specifics).
     */
    public function up(): void
    {
        Schema::create('school_year_fees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('school_year_id')->constrained('school_years')->cascadeOnDelete();
            $table->string('year_level')->default('all'); // all | grade_11 | grade_12
            $table->string('name');
            $table->string('type')->default('default'); // default | add_on
            $table->decimal('amount', 10, 2)->default(0);
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_year_fees');
    }
};
