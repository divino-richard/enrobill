<?php

use App\Models\FeeStructure;
use App\Models\Term;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_structures', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Term::class)->constrained()->cascadeOnDelete();
            $table->string('track');
            $table->string('year_level');
            $table->timestamps();

            // One flat fee package per program per term.
            $table->unique(['term_id', 'track', 'year_level']);
        });

        Schema::create('fee_structure_items', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(FeeStructure::class)->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('amount', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_structure_items');
        Schema::dropIfExists('fee_structures');
    }
};
