<?php

use App\Models\Program;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('program_fee_items', function (Blueprint $table) {
            $table->id();
            // The default fee items a program's fee structures are seeded with.
            $table->foreignIdFor(Program::class)->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('amount', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_fee_items');
    }
};
