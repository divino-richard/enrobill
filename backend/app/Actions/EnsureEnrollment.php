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
     *
     * @param  int|null  $discountId  the voucher granted for this year, if any
     */
    public function __invoke(
        Student $student,
        SchoolYear $schoolYear,
        ?int $createdBy = null,
        ?int $discountId = null,
    ): Enrollment {
        // The downpayment waiver isn't set here — it's derived at bill generation
        // from whether the enrollment carries a voucher.
        $enrollment = Enrollment::firstOrCreate(
            ['student_id' => $student->id, 'school_year_id' => $schoolYear->id],
            [
                'track' => $student->track_or_strand,
                'year_level' => $student->year_level,
                'discount_id' => $discountId,
                'status' => 'pending',
                'created_by' => $createdBy,
            ],
        );

        // Keep the student's current-standing snapshot moving forward with their
        // newest enrollment, in step with year level. Forward-only, so creating an
        // enrollment for an older year never rolls the snapshot back. School year
        // keys are fixed-width ("YYYY-YYYY"), so string comparison orders them.
        if ($student->school_year === null || $schoolYear->school_year > $student->school_year) {
            $student->update(['school_year' => $schoolYear->school_year]);
        }

        return $enrollment;
    }
}
