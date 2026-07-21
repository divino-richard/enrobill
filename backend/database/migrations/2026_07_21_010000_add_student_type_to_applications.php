<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whether the applicant is new to the school or already studied here.
     *
     * A continuing student's records are already with the registrar (typically a
     * Grade 12 applicant who finished Grade 11 here before this system existed),
     * so they are not asked to re-upload verification documents. A transferee —
     * including a Grade 12 one — still has to comply.
     *
     * Nullable so applications submitted before this column existed keep working;
     * a null is treated as "new" (documents required), the safe default.
     */
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('student_type')->nullable()->index()->after('enrollment_type');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('student_type');
        });
    }
};
