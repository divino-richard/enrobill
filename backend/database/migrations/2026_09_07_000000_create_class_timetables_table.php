<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_timetables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('entries')->nullable();
            $table->json('published_entries')->nullable();
            $table->unsignedInteger('version')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_timetables');
    }
};
