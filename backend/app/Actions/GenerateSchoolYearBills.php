<?php

namespace App\Actions;

use App\Models\Bill;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Validation\ValidationException;

class GenerateSchoolYearBills
{
    /**
     * Students eligible to be billed for a school year: newly admitted students
     * and continuing (already enrolled) ones. Excludes dropped, graduated and
     * inactive students.
     */
    private const BILLABLE_STATUSES = ['admitted', 'enrolled'];

    public function __construct(private GenerateBillForStudent $generateBill) {}

    /**
     * Generate bills for every billable student in the active school year who
     * isn't billed for it yet, from the year's global fee schedule. Returns the
     * number of bills created. Idempotent — re-running only bills students still
     * missing one.
     */
    public function __invoke(): int
    {
        $schoolYear = SchoolYear::active();

        if ($schoolYear === null) {
            throw ValidationException::withMessages([
                'billing' => 'No school year is currently active.',
            ]);
        }

        if ($schoolYear->fees()->count() === 0) {
            throw ValidationException::withMessages([
                'billing' => 'No fees are defined for the active school year yet.',
            ]);
        }

        $alreadyBilled = Bill::query()
            ->where('school_year_id', $schoolYear->id)
            ->pluck('student_id')
            ->all();

        $students = Student::query()
            ->whereIn('status', self::BILLABLE_STATUSES)
            ->whereNotIn('id', $alreadyBilled)
            ->get();

        $created = 0;

        foreach ($students as $student) {
            $enrollment = $student->enrollments()
                ->where('school_year_id', $schoolYear->id)
                ->first();

            $bill = ($this->generateBill)(
                $student,
                $schoolYear,
                noDownpayment: (bool) ($enrollment?->no_downpayment),
            );

            if ($bill !== null && $bill->wasRecentlyCreated) {
                $created++;
            }
        }

        return $created;
    }
}
