<?php

namespace App\Actions;

use App\Models\Enrollment;
use App\Models\Student;
use App\Models\Term;

class EnsureEnrollment
{
    /**
     * Find or create the student's (pending) enrollment for a term, snapshotting
     * their current program and year level. Idempotent — returns the existing
     * enrollment untouched if one already exists for the term.
     */
    public function __invoke(Student $student, Term $term, ?int $createdBy = null): Enrollment
    {
        return Enrollment::firstOrCreate(
            ['student_id' => $student->id, 'term_id' => $term->id],
            [
                'track' => $student->track_or_strand,
                'year_level' => $student->year_level,
                'status' => 'pending',
                'created_by' => $createdBy,
            ],
        );
    }
}
