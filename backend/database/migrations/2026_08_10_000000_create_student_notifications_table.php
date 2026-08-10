<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A student's in-app notification inbox. Created by App\Actions\NotifyStudent
     * from wherever a student-facing event already happens — never a queue, just a
     * row written inline. `dedupe_key` lets recurring sources (e.g. the installment
     * due-date reminder) avoid re-notifying for the same thing on every run.
     */
    public function up(): void
    {
        Schema::create('student_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->string('category'); // billing | enrollment | applications | documents | transfer | progression | account
            $table->string('title');
            $table->text('message');
            $table->string('cta_label')->nullable();
            $table->string('cta_url')->nullable();
            $table->boolean('action_required')->default(false);
            $table->string('dedupe_key')->nullable()->unique();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index('student_id');
            $table->index('read_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_notifications');
    }
};
