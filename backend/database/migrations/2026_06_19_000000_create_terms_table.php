<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('terms', function (Blueprint $table) {
            $table->id();
            $table->string('school_year');
            $table->string('semester');
            // Whether enrollment is currently open for this term. At most one
            // term is open at a time.
            $table->boolean('is_open')->default(false)->index();
            $table->timestamps();

            $table->unique(['school_year', 'semester']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('terms');
    }
};
