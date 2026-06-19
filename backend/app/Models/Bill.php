<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'student_id', 'term_id', 'fee_structure_id', 'total', 'amount_paid', 'status',
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
     * Recompute amount_paid and status from recorded payments and current
     * credits. Call after any payment or adjustment change.
     */
    public function recalculate(): void
    {
        $paid = round((float) $this->payments()->sum('amount'), 2);
        $net = $this->netTotal();

        $status = match (true) {
            $paid <= 0 => 'unpaid',
            $paid >= $net => 'paid',
            default => 'partial',
        };

        $this->update(['amount_paid' => $paid, 'status' => $status]);
    }
}
