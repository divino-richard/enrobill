<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * An optional note an admin records when deciding an application — typically
     * the reason for a rejection, shown to the applicant and included in the email.
     */
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->text('decision_note')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('decision_note');
        });
    }
};
