<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('dropping_requests')->where('status', 'under_review')->update(['status' => 'submitted']);
        Schema::table('dropping_requests', function (Blueprint $table) {
            $table->dropForeign(['documents_verified_by']);
            $table->dropForeign(['finance_reviewed_by']);
            $table->dropColumn(['checklist', 'documents_verified_by', 'documents_verified_at', 'finance_outcome', 'finance_remarks', 'reviewed_balance', 'finance_reviewed_by', 'finance_reviewed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('dropping_requests', function (Blueprint $table) {
            $table->json('checklist')->nullable();
            $table->foreignId('documents_verified_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('documents_verified_at')->nullable();
            $table->string('finance_outcome')->nullable();
            $table->text('finance_remarks')->nullable();
            $table->decimal('reviewed_balance', 12, 2)->nullable();
            $table->foreignId('finance_reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('finance_reviewed_at')->nullable();
        });
    }
};
