<?php

namespace Tests\Concerns;

use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;

trait CreatesLegacyReturningEnrollment
{
    /** Seed records made before settlement became a prerequisite for creation. */
    private function legacyReturn(Student $student, SchoolYear $year, Enrollment $source, string $program = 'stem'): Enrollment
    {
        $return = Enrollment::withoutEvents(fn () => Enrollment::create([
            'student_id' => $student->id, 'school_year_id' => $year->id,
            'returning_from_enrollment_id' => $source->id, 'track' => $program,
            'year_level' => 'grade_11', 'status' => 'pending',
        ]));
        $bill = Bill::create(['student_id' => $student->id, 'enrollment_id' => $return->id,
            'school_year_id' => $year->id, 'total' => 1000, 'amount_paid' => 0, 'status' => 'unpaid']);
        $bill->installments()->create(['sequence' => 1, 'label' => Bill::DOWNPAYMENT_LABEL, 'amount' => 200, 'due_date' => '2027-06-01']);
        $bill->installments()->create(['sequence' => 2, 'label' => 'Installment 1', 'amount' => 800, 'due_date' => '2027-07-01']);

        return $return;
    }
}
