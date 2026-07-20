<?php

use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-semester clearance and grade slips a student uploads, which the admin
     * reads at year-end to decide promote (pass) or retain (fail).
     *
     * The school year itself carries no semester column — that was deliberately
     * removed — so the semester lives here, on the document, scoped to the
     * student's school year. One slot per (student, year, semester, type):
     * re-uploading replaces what is there rather than piling up revisions.
     */
    public function up(): void
    {
        Schema::create('student_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(Student::class)->constrained()->cascadeOnDelete();
            $table->foreignIdFor(SchoolYear::class)->constrained()->cascadeOnDelete();
            $table->string('semester');  // first | second
            $table->string('type');      // clearance | grades
            $table->string('s3_key');
            $table->string('file_name');
            $table->unsignedBigInteger('size')->nullable();
            $table->string('content_type')->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'school_year_id', 'semester', 'type'], 'student_documents_slot_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_documents');
    }
};
