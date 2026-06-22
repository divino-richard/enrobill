<?php

namespace App\Actions;

use App\Models\Bill;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

class GenerateBillForStudent
{
    public function __construct(
        private EnsureEnrollment $ensureEnrollment,
        private GenerateInstallmentSchedule $generateSchedule,
    ) {}

    /**
     * Ensure the student's enrollment for a school year and generate their bill
     * from the year's global fee schedule (items matching the student's year
     * level). Snapshots the fee items, builds the installment plan, and finalizes
     * enrollment when no downpayment is required. Idempotent — returns the existing
     * bill if one already exists. Returns null (enrollment still ensured) when no
     * fees are defined for the year yet.
     */
    public function __invoke(
        Student $student,
        SchoolYear $schoolYear,
        ?int $createdBy = null,
        bool $noDownpayment = false,
    ): ?Bill {
        $enrollment = ($this->ensureEnrollment)($student, $schoolYear, $createdBy, $noDownpayment);

        // The admin's decision at acceptance is authoritative for the flag.
        if ((bool) $enrollment->no_downpayment !== $noDownpayment) {
            $enrollment->update(['no_downpayment' => $noDownpayment]);
        }

        $existing = Bill::query()
            ->where('student_id', $student->id)
            ->where('school_year_id', $schoolYear->id)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        $fees = $schoolYear->fees()
            ->whereIn('year_level', ['all', (string) $student->year_level])
            ->orderBy('sequence')
            ->orderBy('id')
            ->get();

        if ($fees->isEmpty()) {
            return null; // No fee schedule for this year yet — bill later.
        }

        return DB::transaction(function () use ($student, $schoolYear, $enrollment, $fees) {
            $bill = $student->bills()->create([
                'school_year_id' => $schoolYear->id,
                'enrollment_id' => $enrollment->id,
                'total' => round((float) $fees->sum('amount'), 2),
                'amount_paid' => 0,
                'status' => 'unpaid',
            ]);

            $bill->items()->createMany(
                $fees->map(fn ($fee) => ['name' => $fee->name, 'amount' => $fee->amount])->all(),
            );

            $bill->setRelation('enrollment', $enrollment);
            ($this->generateSchedule)($bill);

            // Private-school graduates (no downpayment) enroll on the spot.
            $bill->load(['enrollment', 'installments']);
            $bill->settleEnrollment();

            return $bill;
        });
    }
}
