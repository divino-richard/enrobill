<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            // Commitment to submit required documents the applicant can't yet
            // provide, plus the estimated date they'll comply.
            $table->text('document_promissory_note')->nullable()->after('prev_school_type');
            $table->date('document_promissory_date')->nullable()->after('document_promissory_note');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['document_promissory_note', 'document_promissory_date']);
        });
    }
};
