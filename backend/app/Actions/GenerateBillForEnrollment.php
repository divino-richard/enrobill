<?php

namespace App\Actions;

use App\Models\Bill;
use App\Models\Discount;
use App\Models\Enrollment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GenerateBillForEnrollment
{
    public function __construct(private GenerateInstallmentSchedule $generateSchedule) {}

    /**
     * Generate the bill for a (pending) enrollment from its school year's fee
     * schedule, applying the cashier's selected catalog credits — discounts,
     * voucher and/or freebie. Fixed/percentage credits apply first, then any
     * full-coverage (`full`) credit zeroes whatever is left. A voucher waives the
     * downpayment (per the school's voucher rules). Idempotent — returns the
     * existing bill if the enrollment already has one.
     *
     * @param  list<int>  $discountIds  catalog discount ids, in apply order
     */
    public function __invoke(Enrollment $enrollment, array $discountIds = [], bool $noDownpayment = false): Bill
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
            return $existing;
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

        // The selected, active catalog credits — fixed/percentage first so a
        // full-coverage credit lands on whatever balance remains.
        $discounts = Discount::query()
            ->whereIn('id', $discountIds)
            ->where('is_active', true)
            ->get()
            ->sortBy(fn (Discount $d) => array_search($d->id, $discountIds, true))
            ->sortBy(fn (Discount $d) => $d->type === 'full' ? 1 : 0)
            ->values();

        return DB::transaction(function () use ($student, $schoolYear, $enrollment, $fees, $discounts, $noDownpayment) {
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

            $hasVoucher = false;
            foreach ($discounts as $discount) {
                $bill->load('adjustments'); // keep netTotal()/creditFor() current
                $bill->adjustments()->create([
                    'discount_id' => $discount->id,
                    'label' => $discount->name,
                    'type' => $discount->type,
                    'value' => $discount->value,
                    'amount' => $bill->creditFor($discount),
                ]);
                $hasVoucher = $hasVoucher || $discount->category === 'voucher';
            }

            // Voucher students pay no downpayment; honour an explicit waiver too.
            // Authoritative at generation, so re-generating clears a stale flag.
            $waive = $noDownpayment || $hasVoucher;
            if ((bool) $enrollment->no_downpayment !== $waive) {
                $enrollment->update(['no_downpayment' => $waive]);
            }

            $bill->setRelation('enrollment', $enrollment->fresh());
            $bill->load('adjustments');
            ($this->generateSchedule)($bill);

            $bill->load(['enrollment', 'installments', 'adjustments']);
            $bill->recalculate();
            $bill->settleEnrollment();

            return $bill->fresh();
        });
    }
}
