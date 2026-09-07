<?php

namespace App\Actions;

use App\Models\Bill;
use App\Models\Discount;
use App\Models\Enrollment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GenerateBillForEnrollment
{
    public function __construct(
        private GenerateInstallmentSchedule $generateSchedule,
        private ReconcileEnrollmentIncentives $reconcileIncentives,
    ) {}

    /**
     * Generate the bill for a (pending) enrollment from its school year's fee
     * schedule. Both credits are derived here rather than chosen at billing time:
     * the voucher is the one the enrollment carries (granted by the admin on
     * acceptance), while incentive awards are reconciled centrally after the
     * ordinary voucher credit. A voucher — and only a voucher — waives the
     * downpayment and unlocks an eligible incentive. Idempotent — an existing
     * bill is reconciled and returned.
     */
    public function __invoke(Enrollment $enrollment): Bill
    {
        $enrollment->loadMissing(['student', 'schoolYear']);
        $schoolYear = $enrollment->schoolYear;
        $student = $enrollment->student;

        abort_if($schoolYear === null || $student === null, 422, 'This enrollment is incomplete.');

        $existing = Bill::query()
            ->where('student_id', $student->id)
            ->where('school_year_id', $schoolYear->id)
            ->first();

        if ($existing !== null) {
            ($this->reconcileIncentives)($enrollment);

            return $existing->fresh();
        }

        $fees = $schoolYear->fees()
            ->whereIn('year_level', ['all', (string) $enrollment->year_level])
            ->orderBy('sequence')
            ->orderBy('id')
            ->get();

        if ($fees->isEmpty()) {
            throw ValidationException::withMessages([
                'fees' => "Set up fees for SY {$schoolYear->school_year} before generating bills.",
            ]);
        }

        // The voucher granted on this enrollment, if it is still active. Retiring a
        // voucher from the catalog stops it being applied to bills not yet raised.
        $voucher = Discount::query()
            ->whereKey($enrollment->discount_id)
            ->where('category', 'voucher')
            ->where('is_active', true)
            ->first();

        $hasVoucher = $voucher !== null;

        return DB::transaction(function () use ($student, $schoolYear, $enrollment, $fees, $voucher, $hasVoucher) {
            $bill = $student->bills()->create([
                'school_year_id' => $schoolYear->id,
                'enrollment_id' => $enrollment->id,
                'total' => round((float) $fees->sum('amount'), 2),
                'amount_paid' => 0,
                'status' => 'unpaid',
            ]);

            $bill->items()->createMany(
                $fees->map(fn ($fee) => [
                    'name' => $fee->name,
                    'category' => $fee->category,
                    'amount' => $fee->amount,
                ])->all(),
            );

            // Vouchers/catalog credits first.
            if ($voucher !== null) {
                $bill->load('adjustments'); // keep netTotal()/creditFor() current
                $bill->adjustments()->create([
                    'discount_id' => $voucher->id,
                    'label' => $voucher->name,
                    'type' => $voucher->type,
                    'value' => $voucher->value,
                    'amount' => $bill->creditFor($voucher),
                ]);
            }

            // Only a voucher waives the downpayment. Authoritative at generation,
            // so re-generating clears a stale flag.
            if ((bool) $enrollment->no_downpayment !== $hasVoucher) {
                $enrollment->update(['no_downpayment' => $hasVoucher]);
            }

            $bill->setRelation('enrollment', $enrollment->fresh());
            $bill->load('adjustments');
            ($this->generateSchedule)($bill);

            $bill->load(['enrollment', 'installments', 'adjustments']);
            $bill->recalculate();
            $bill->settleEnrollment();

            // Materialize all earned reasons and post at most one shared
            // zero-tuition adjustment after vouchers and ordinary discounts.
            ($this->reconcileIncentives)($enrollment->fresh());

            return $bill->fresh();
        });
    }
}
