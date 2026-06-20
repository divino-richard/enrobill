<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Payments can now be submitted by students (with a proof screenshot) and
     * await admin verification. Existing payments were admin-recorded, so they
     * default to verified.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('status')->default('verified')->after('method')->index();
            // S3 key of the proof-of-payment screenshot (student submissions).
            $table->string('proof_key')->nullable()->after('reference');
            // The student who submitted the payment, if self-submitted.
            $table->foreignIdFor(User::class, 'submitted_by')->nullable()->after('recorded_by')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('submitted_by');
            $table->dropColumn(['status', 'proof_key']);
        });
    }
};
