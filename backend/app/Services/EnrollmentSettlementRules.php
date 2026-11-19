<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Enrollment;
use Illuminate\Validation\ValidationException;

class EnrollmentSettlementRules
{
    public const MESSAGE = 'Fully settle all previous school-year bills before proceeding to the next grade or enrollment. Only verified payments and applied credits count.';

    /** School-year labels are chronological even when calendar dates are missing. */
    public function balance(int $studentId, string $schoolYear, bool $includeYear = false): float
    {
        $bills = Bill::where('student_id', $studentId)
            ->whereHas('schoolYear', fn ($year) => $year->where('school_year', $includeYear ? '<=' : '<', $schoolYear))
            ->with('adjustments')
            ->withSum(['payments as verified_amount_paid' => fn ($payments) => $payments->where('status', 'verified')], 'amount')
            ->get();

        return Currency::pesos($bills->sum(function (Bill $bill) {
            // Read the ledger instead of trusting a potentially stale paid flag
            // or cached total. This changes only this in-memory calculation.
            $bill->amount_paid = (float) $bill->verified_amount_paid;

            return Currency::cents($bill->balance());
        }));
    }

    public function blockers(Enrollment $enrollment): array
    {
        $year = $enrollment->schoolYear;

        return $year && $this->balance($enrollment->student_id, $year->school_year) > 0
            ? [self::MESSAGE] : [];
    }

    public function assertCanEnroll(Enrollment $enrollment): void
    {
        if ($blockers = $this->blockers($enrollment)) {
            throw ValidationException::withMessages(['status' => $blockers]);
        }
    }
}
