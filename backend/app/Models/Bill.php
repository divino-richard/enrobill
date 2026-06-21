<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'student_id', 'term_id', 'enrollment_id', 'fee_structure_id', 'total', 'amount_paid', 'status',
    'payment_option',
])]
class Bill extends Model
{
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
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * The fee structure (program + year level) this bill was generated from.
     *
     * @return BelongsTo<FeeStructure, $this>
     */
    public function feeStructure(): BelongsTo
    {
        return $this->belongsTo(FeeStructure::class);
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
     * The amount a student should pay now: the next unpaid installment's
     * remaining balance if there's a plan, otherwise the full outstanding
     * balance. Based on verified payments only. Zero when nothing is owed.
     */
    public function amountDue(): float
    {
        $outstanding = round(max($this->netTotal() - (float) $this->amount_paid, 0), 2);

        if ($outstanding <= 0) {
            return 0.0;
        }

        $installments = $this->relationLoaded('installments')
            ? $this->installments
            : $this->installments()->orderBy('sequence')->get();

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
     * Recompute amount_paid and status from recorded payments and current
     * credits. Call after any payment or adjustment change.
     */
    public function recalculate(): void
    {
        // Only verified payments count toward what's been paid; pending
        // (student-submitted) and rejected payments don't.
        $paid = round((float) $this->payments()->where('status', 'verified')->sum('amount'), 2);
        $net = $this->netTotal();

        $status = match (true) {
            $paid <= 0 => 'unpaid',
            $paid >= $net => 'paid',
            default => 'partial',
        };

        $this->update(['amount_paid' => $paid, 'status' => $status]);
    }

    /**
     * Whether enough has been paid (verified) to enroll the student: the full
     * net total for a full-payment bill, or the first installment (downpayment)
     * for an installment plan.
     */
    public function enrollmentDownpaymentMet(): bool
    {
        $paid = (float) $this->amount_paid;

        if ($paid <= 0) {
            return false;
        }

        $installments = $this->relationLoaded('installments')
            ? $this->installments
            : $this->installments()->orderBy('sequence')->get();

        if ($installments->isEmpty()) {
            return $paid >= $this->netTotal() - 0.01;
        }

        return $paid >= (float) $installments->first()->amount - 0.01;
    }

    /**
     * Finalize enrollment once the downpayment (or full payment) is met: mark
     * this term's enrollment "enrolled" and mirror it onto the student's global
     * status. One-directional — never reverts an enrollment.
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
}
