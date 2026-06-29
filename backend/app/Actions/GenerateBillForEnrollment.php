<?php

namespace App\Actions;

use App\Models\Bill;
use App\Models\Discount;
use App\Models\Enrollment;
use App\Models\Freebie;
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
     * schedule, applying the cashier's selected catalog credits (vouchers) and any
     * eligible freebies. Vouchers apply first; a freebie then zeroes whatever is
     * left. A voucher — and only a voucher — waives the downpayment (per the
     * school's voucher rules). Idempotent — returns the existing bill if the
     * enrollment already has one.
     *
     * @param  list<int>  $discountIds  catalog discount (voucher) ids, in apply order
     * @param  list<int>  $freebieIds  freebie (promo) ids to apply
     */
    public function __invoke(
        Enrollment $enrollment,
        array $discountIds = [],
        array $freebieIds = [],
    ): Bill {
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

        // The selected, active catalog credits (vouchers), in the requested order.
        $discounts = Discount::query()
            ->whereIn('id', $discountIds)
            ->where('is_active', true)
            ->get()
            ->sortBy(fn (Discount $d) => array_search($d->id, $discountIds, true))
            ->values();

        $hasVoucher = $discounts->contains(fn (Discount $d) => $d->category === 'voucher');

        // Freebies only apply alongside a voucher, and only to students who qualify
        // — "Promo + Voucher = Zero Tuition Balance" (docs/business.md).
        $freebies = collect();
        if ($freebieIds !== []) {
            if (! $hasVoucher) {
                throw ValidationException::withMessages([
                    'freebieIds' => 'A freebie can only be applied to a student who also has a voucher.',
                ]);
            }

            $eligibleIds = $this->freebieEligibility->for($enrollment)->pluck('id');
            $freebies = Freebie::query()->whereIn('id', $freebieIds)->get();

            if ($freebies->contains(fn (Freebie $f) => ! $eligibleIds->contains($f->id))) {
                throw ValidationException::withMessages([
                    'freebieIds' => 'A selected freebie does not apply to this student.',
                ]);
            }
        }

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
