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
        private FreebieEligibility $freebieEligibility,
    ) {}

    /**
     * Generate the bill for a (pending) enrollment from its school year's fee
     * schedule. Both credits are derived here rather than chosen at billing time:
     * the voucher is the one the enrollment carries (granted by the admin on
     * acceptance), and the freebies are whatever the student qualifies for. The
     * voucher applies first; a freebie then zeroes whatever is left. A voucher —
     * and only a voucher — waives the downpayment, and gates the freebies with it
     * ("Promo + Voucher = Zero Tuition Balance", docs/business.md). Idempotent —
     * returns the existing bill if the enrollment already has one.
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

        // The voucher granted on this enrollment, if it is still active. Retiring a
        // voucher from the catalog stops it being applied to bills not yet raised.
        $voucher = Discount::query()
            ->whereKey($enrollment->discount_id)
            ->where('category', 'voucher')
            ->where('is_active', true)
            ->first();

        $discounts = collect($voucher !== null ? [$voucher] : []);
        $hasVoucher = $voucher !== null;

        // Every promo the student qualifies for, but only alongside a voucher.
        $freebies = $hasVoucher
            ? $this->freebieEligibility->for($enrollment)
            : collect();

        return DB::transaction(function () use ($student, $schoolYear, $enrollment, $fees, $discounts, $freebies, $hasVoucher) {
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
            foreach ($discounts as $discount) {
                $bill->load('adjustments'); // keep netTotal()/creditFor() current
                $bill->adjustments()->create([
                    'discount_id' => $discount->id,
                    'label' => $discount->name,
                    'type' => $discount->type,
                    'value' => $discount->value,
                    'amount' => $bill->creditFor($discount),
                ]);
            }

            // Then freebies — each covers whatever balance remains (→ ₱0).
            foreach ($freebies as $freebie) {
                $bill->load('adjustments');
                $bill->adjustments()->create([
                    'discount_id' => null,
                    'label' => $freebie->name,
                    'type' => 'full',
                    'value' => 0,
                    'amount' => $bill->netTotal(),
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

            return $bill->fresh();
        });
    }
}
