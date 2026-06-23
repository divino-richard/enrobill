<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

#[Fillable([
    'student_id', 'school_year_id', 'enrollment_id', 'total', 'amount_paid', 'status',
])]
class Bill extends Model
{
    /** The label given to the required upfront installment row. */
    public const DOWNPAYMENT_LABEL = 'Downpayment';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
            'amount_paid' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<SchoolYear, $this>
     */
    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }

    /**
     * The academic enrollment this bill bills for.
     *
     * @return BelongsTo<Enrollment, $this>
     */
    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    /**
     * @return HasMany<BillItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(BillItem::class);
    }

    /**
     * Discounts, scholarships and vouchers credited against this bill.
     *
     * @return HasMany<BillAdjustment, $this>
     */
    public function adjustments(): HasMany
    {
        return $this->hasMany(BillAdjustment::class);
    }

    /**
     * The installment schedule for this bill, in due order.
     *
     * @return HasMany<BillInstallment, $this>
     */
    public function installments(): HasMany
    {
        return $this->hasMany(BillInstallment::class)->orderBy('sequence');
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Total credits (discounts/scholarships/vouchers) applied to this bill.
     */
    public function discountTotal(): float
    {
        $adjustments = $this->relationLoaded('adjustments')
            ? $this->adjustments
            : $this->adjustments();

        return round((float) $adjustments->sum('amount'), 2);
    }

    /**
     * What the student actually owes: gross charges minus credits, floored at 0.
     */
    public function netTotal(): float
    {
        return round(max((float) $this->total - $this->discountTotal(), 0), 2);
    }

    /**
     * The peso credit a catalog discount would apply to this bill right now:
     * fixed/percentage resolve against the gross charges (capped); a `full`
     * (full-coverage) credit covers whatever balance is left — the current net,
     * after any credits already applied — so the bill zeroes out.
     */
    public function creditFor(Discount $discount): float
    {
        return $discount->type === 'full'
            ? $this->netTotal()
            : $discount->resolveAmount((float) $this->total);
    }

    /**
     * The amount a student should pay now: the next unpaid installment's remaining
     * balance, based on verified payments only. Zero when nothing is owed.
     */
    public function amountDue(): float
    {
        $outstanding = round(max($this->netTotal() - (float) $this->amount_paid, 0), 2);

        if ($outstanding <= 0) {
            return 0.0;
        }

        $installments = $this->orderedInstallments();

        if ($installments->isEmpty()) {
            return $outstanding;
        }

        // Allocate verified payments across installments in due order; the first
        // not-fully-covered installment's remainder is what's due now.
        $remaining = (float) $this->amount_paid;
        foreach ($installments as $installment) {
            $amount = (float) $installment->amount;
            if ($remaining >= $amount) {
                $remaining = round($remaining - $amount, 2);

                continue;
            }

            return round(min($amount - $remaining, $outstanding), 2);
        }

        return $outstanding;
    }

    /**
     * Recompute amount_paid and status from recorded payments and current credits,
     * then re-spread the remaining balance across the unpaid monthly installments.
     * Call after any payment or adjustment change.
     */
    public function recalculate(): void
    {
        // Only verified payments count toward what's been paid; pending
        // (student-submitted) and rejected payments don't.
        $paid = round((float) $this->payments()->where('status', 'verified')->sum('amount'), 2);
        $net = $this->netTotal();

        $status = match (true) {
            $net <= 0 => 'paid',   // fully covered by credits (e.g. a freebie)
            $paid <= 0 => 'unpaid',
            $paid >= $net => 'paid',
            default => 'partial',
        };

        $this->update(['amount_paid' => $paid, 'status' => $status]);

        $this->redistributeInstallments();
    }

    /**
     * Spread the outstanding balance equally across the monthly installments that
     * aren't fully paid yet, preserving their due dates. The downpayment row is
     * never touched. This is what makes "pay more now → smaller monthly" work: any
     * amount paid beyond the downpayment lowers every remaining monthly evenly.
     */
    public function redistributeInstallments(): void
    {
        $installments = $this->orderedInstallments();

        if ($installments->isEmpty()) {
            return;
        }

        $downpayment = $installments->firstWhere('label', self::DOWNPAYMENT_LABEL);
        $monthlies = $installments
            ->reject(fn ($i) => $i->label === self::DOWNPAYMENT_LABEL)
            ->values();

        if ($monthlies->isEmpty()) {
            return;
        }

        $net = $this->netTotal();
        $paid = (float) $this->amount_paid;
        $dpAmount = $downpayment ? (float) $downpayment->amount : 0.0;

        // How much of what's been paid has reached the monthly installments.
        $paidToMonthlies = round(max($paid - $dpAmount, 0), 2);

        // Walk the monthlies to find the fully-paid prefix; `carry` is the partial
        // payment sitting on the first not-fully-paid monthly.
        $remaining = $paidToMonthlies;
        $future = [];
        $started = false;
        foreach ($monthlies as $monthly) {
            if ($started) {
                $future[] = $monthly;

                continue;
            }

            $amount = (float) $monthly->amount;
            if ($remaining >= $amount - 0.001) {
                $remaining = round($remaining - $amount, 2);
            } else {
                $started = true;
                $future[] = $monthly;
            }
        }

        $carry = round($remaining, 2);
        $count = count($future);

        if ($count === 0) {
            return;
        }

        $monthliesTotal = round($net - $dpAmount, 2);
        $outstanding = round(max($monthliesTotal - $paidToMonthlies, 0), 2);

        $base = floor($outstanding / $count * 100) / 100;
        $allocated = 0.0;

        foreach ($future as $index => $monthly) {
            if ($index === $count - 1) {
                $amount = round($outstanding - $allocated, 2);
            } else {
                $amount = $base;
                $allocated = round($allocated + $base, 2);
            }

            // The first not-fully-paid monthly carries the partial already paid
            // into it, so its remaining balance still equals the even amount.
            if ($index === 0) {
                $amount = round($amount + $carry, 2);
            }

            if ((float) $monthly->amount !== $amount) {
                $monthly->update(['amount' => $amount]);
            }
        }
    }

    /**
     * Whether enough has been paid (verified) to enroll the student: the required
     * downpayment for a normal bill, or nothing at all when the downpayment is
     * waived (e.g. a private-school graduate).
     */
    public function enrollmentDownpaymentMet(): bool
    {
        // Nothing left to pay (e.g. a freebie zeroed the balance) — already met.
        if ($this->netTotal() <= 0) {
            return true;
        }

        if ($this->enrollment?->no_downpayment) {
            return true;
        }

        $paid = (float) $this->amount_paid;

        if ($paid <= 0) {
            return false;
        }

        $installments = $this->orderedInstallments();

        if ($installments->isEmpty()) {
            return $paid >= $this->netTotal() - 0.01;
        }

        return $paid >= (float) $installments->first()->amount - 0.01;
    }

    /**
     * Whether this bill can be voided (deleted) when undoing a year-end decision:
     * nothing has been paid and no payment is pending verification. A bill with any
     * verified or pending payment is locked. Rejected payments don't block.
     */
    public function isVoidable(): bool
    {
        return (float) $this->amount_paid <= 0
            && $this->payments()->whereIn('status', ['verified', 'pending'])->doesntExist();
    }

    /**
     * Finalize enrollment once the downpayment (or full payment) is met: mark this
     * year's enrollment "enrolled" and mirror it onto the student's global status.
     * One-directional — never reverts an enrollment.
     */
    public function settleEnrollment(): void
    {
        if (! $this->enrollmentDownpaymentMet()) {
            return;
        }

        $enrollment = $this->enrollment;

        if ($enrollment !== null) {
            $enrollment->markEnrolled();
            $this->student?->syncStatusFromLatestEnrollment();

            return;
        }

        // Fallback for any bill without a linked enrollment (legacy data).
        $student = $this->student;
        if ($student !== null && $student->status === 'admitted') {
            $student->update(['status' => 'enrolled']);
        }
    }

    /**
     * The installment rows in due order, from the relation cache when available.
     *
     * @return Collection<int, BillInstallment>
     */
    private function orderedInstallments()
    {
        return $this->relationLoaded('installments')
            ? $this->installments
            : $this->installments()->orderBy('sequence')->get();
    }
}
