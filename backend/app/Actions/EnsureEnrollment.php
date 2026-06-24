<?php

namespace App\Actions;

use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;

class EnsureEnrollment
{
    /**
     * Find or create the student's (pending) enrollment for a school year,
     * snapshotting their current program and year level. Idempotent — returns the
     * existing enrollment untouched if one already exists for the year.
     */
    public function __invoke(
        Student $student,
        SchoolYear $schoolYear,
        ?int $createdBy = null,
    ): Enrollment {
        // The downpayment waiver isn't set here — it's derived at bill generation
        // from whether a voucher is applied.
        return Enrollment::firstOrCreate(
            ['student_id' => $student->id, 'school_year_id' => $schoolYear->id],
            [
                'track' => $student->track_or_strand,
                'year_level' => $student->year_level,
                'status' => 'pending',
                'created_by' => $createdBy,
            ],
        );
    }
}
