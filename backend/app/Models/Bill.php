<?php

namespace App\Models;

use App\Actions\AssignSectionOnEnroll;
use App\Actions\NotifyStudent;
use App\Services\Currency;
use App\Services\PaymentArrangementService;
use App\Services\StudentCreditService;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

#[Fillable([
    'student_id', 'school_year_id', 'enrollment_id', 'total', 'amount_paid', 'status',
])]
class Bill extends Model
{
    public function droppingAssessment(): HasOne
    {
        return $this->hasOne(DroppingAssessment::class);
    }

    public function creditAllocations(): HasMany
    {
        return $this->hasMany(StudentCreditAllocation::class);
    }

    public function issuedCredit(): HasOne
    {
        return $this->hasOne(StudentCredit::class, 'source_bill_id');
    }

    public function paymentArrangement(): HasOne
    {
        return $this->hasOne(PaymentArrangement::class);
    }

    public function hasDroppingAssessment(): bool
    {
        return $this->droppingAssessment()->exists();
    }

    public function creditApplied(): float
    {
        return Currency::pesos($this->creditAllocations()->get()->sum(fn ($row) => Currency::cents($row->amount) - Currency::cents($row->released_amount)));
    }

    public function effectivePaymentTotal(): float
    {
        return Currency::pesos(Currency::cents($this->amount_paid) + Currency::cents($this->creditApplied()));
    }

    public function balance(): float
    {
        return Currency::pesos(max(Currency::cents($this->netTotal()) - Currency::cents($this->effectivePaymentTotal()), 0));
    }

    public function assertMutableAssessment(): void
    {
        if ($this->hasDroppingAssessment()) {
            throw ValidationException::withMessages(['bill' => 'The approved dropping assessment cannot be changed.']);
        }
    }

    protected static function booted(): void
    {
        static::updating(function (Bill $bill) {
            if ($bill->isDirty(['total', 'student_id', 'school_year_id', 'enrollment_id'])) {
                $bill->assertMutableAssessment();
            }
        });
        static::deleting(function (Bill $bill) {
            $bill->assertMutableAssessment();
            if ($bill->creditAllocations()->exists() || $bill->issuedCredit()->exists()) {
                throw ValidationException::withMessages(['bill' => 'A bill with student credit history cannot be deleted.']);
            }
        });
    }

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
     * Whether a voucher (catalog credit) is applied to this bill. A voucher
     * waives the downpayment; freebies (with no linked discount) don't count.
     */
    public function hasVoucher(): bool
    {
        return $this->adjustments()
            ->whereHas('discount', fn ($query) => $query->where('category', 'voucher'))
            ->exists();
    }

    /** Whether a currently active voucher is available to unlock a new award. */
    public function hasActiveVoucher(): bool
    {
        return $this->adjustments()
            ->whereHas('discount', fn ($query) => $query
                ->where('category', 'voucher')
                ->where('is_active', true))
            ->exists();
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
        $assessment = $this->droppingAssessment;
        if ($assessment !== null) {
            return (float) $assessment->final_charge;
        }

        return Currency::pesos(max(Currency::cents($this->total) - Currency::cents($this->discountTotal()), 0));
    }

    /**
     * The peso credit a catalog discount applies to this bill right now. Resolved
     * dynamically against the **remaining balance** so credits stack in order and
     * never over-credit: a `full` credit covers whatever is left (→ ₱0); a fixed
     * amount or percentage (of gross) is capped at what's still owed.
     */
    public function creditFor(Discount $discount): float
    {
        $remaining = $this->netTotal(); // balance after credits already applied

        $nominal = $discount->type === 'full'
            ? $remaining
            : $discount->resolveAmount((float) $this->total);

        return round(min(max($nominal, 0), $remaining), 2);
    }

    /**
     * The amount a student should pay now: the next unpaid installment's remaining
     * balance, based on verified payments only. Zero when nothing is owed.
     */
    public function amountDue(): float
    {
        $outstanding = $this->balance();

        if ($outstanding <= 0) {
            return 0.0;
        }

        $next = $this->installmentSchedule()->first(fn ($row) => $row['balance'] > 0);

        return min($outstanding, (float) ($next['balance'] ?? $outstanding));
    }

    /** Effective installment amounts shared by bills, payment validation and reminders. */
    public function installmentSchedule(): Collection
    {
        $arrangement = app(PaymentArrangementService::class)->schedule($this);
        if ($arrangement !== null) {
            return $arrangement;
        }
        $remaining = Currency::cents($this->effectivePaymentTotal());
        $today = now('Asia/Manila')->toDateString();

        return $this->orderedInstallments()->map(function ($row) use (&$remaining, $today) {
            $amount = Currency::cents($row->amount);
            $applied = min($remaining, $amount);
            $remaining -= $applied;
            $balance = $amount - $applied;
            $date = $row->due_date?->toDateString();
            $status = match (true) {
                $balance <= 0 => 'paid',
                $date && $date < $today => 'overdue',
                $applied > 0 => 'partial',
                default => 'unpaid',
            };

            return ['id' => $row->id, 'sequence' => $row->sequence, 'label' => $row->label,
                'amount' => Currency::pesos($amount), 'amountPaid' => Currency::pesos($applied),
                'balance' => Currency::pesos($balance), 'dueDate' => $date, 'status' => $status];
        })->values();
    }

    /** Whether the effective schedule still has money due on or before this date. */
    public function hasAmountDueBy(string $date): bool
    {
        return $this->balance() > 0 && $this->installmentSchedule()->contains(fn ($row) => $row['balance'] > 0 && $row['dueDate'] && $row['dueDate'] <= $date);
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
        $this->amount_paid = $paid;
        app(StudentCreditService::class)->reconcile($this);
        $net = $this->netTotal();
        $effectivePaid = $this->effectivePaymentTotal();

        $status = match (true) {
            $net <= 0 => 'paid',   // fully covered by credits (e.g. a freebie)
            $effectivePaid <= 0 => 'unpaid',
            $effectivePaid >= $net => 'paid',
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
        if ($this->hasDroppingAssessment()) {
            $this->redistributeDroppingInstallments();

            return;
        }
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
        $paid = $this->effectivePaymentTotal();
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
        if ($this->balance() <= 0) {
            return true;
        }

        if ($this->enrollment?->no_downpayment) {
            return true;
        }

        $paid = $this->effectivePaymentTotal();

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
        return ! $this->hasDroppingAssessment()
            && ! $this->creditAllocations()->exists()
            && ! $this->issuedCredit()->exists()
            && (float) $this->amount_paid <= 0
            && $this->payments()->whereIn('status', ['verified', 'pending'])->doesntExist();
    }

    /**
     * Finalize enrollment once the downpayment (or full payment) is met: mark this
     * year's enrollment "enrolled" and mirror it onto the student's global status.
     * One-directional — never reverts an enrollment.
     */
    public function settleEnrollment(): void
    {
        if ($this->hasDroppingAssessment() || ! $this->enrollmentDownpaymentMet()) {
            return;
        }

        $enrollment = $this->enrollment;

        if ($enrollment !== null) {
            $justEnrolled = $enrollment->status === 'pending';
            $enrollment->markEnrolled();
            if ($enrollment->fresh()->status !== 'enrolled') {
                return;
            }
            // Auto-place the now-enrolled student into a matching section.
            app(AssignSectionOnEnroll::class)($enrollment->fresh());
            $this->student?->syncStatusFromLatestEnrollment();

            if ($justEnrolled && $this->student !== null) {
                app(NotifyStudent::class)(
                    $this->student,
                    'enrollment',
                    'Enrollment status: Enrolled',
                    "Your payment cleared the downpayment — you're now enrolled.",
                    ctaLabel: 'View enrollment',
                    ctaUrl: '/portal',
                );
            }

            return;
        }

        // Fallback for any bill without a linked enrollment (legacy data).
        $student = $this->student;
        if ($student !== null && $student->status === 'admitted') {
            $student->update(['status' => 'enrolled']);
        }
    }

    /** Preserve due dates and paid portions, including an unpaid downpayment. */
    private function redistributeDroppingInstallments(): void
    {
        $installments = $this->installments()->get();
        if ($installments->isEmpty()) {
            // A fully waived original bill can have no due dates to retain.
            // Make its new charge payable on the recorded effective date.
            if ($this->netTotal() > 0) {
                $this->installments()->create(['sequence' => 1, 'label' => 'Dropping charge',
                    'amount' => $this->netTotal(), 'due_date' => $this->droppingAssessment->snapshot['effectiveDate']]);
            }
            $this->unsetRelation('installments');

            return;
        }
        $paidRemaining = min(Currency::cents($this->effectivePaymentTotal()), Currency::cents($this->netTotal()));
        $outstanding = Currency::cents($this->balance());
        $covered = [];
        $unpaid = [];
        foreach ($installments as $row) {
            $amount = Currency::cents($row->amount);
            $applied = min($paidRemaining, $amount);
            $paidRemaining -= $applied;
            $covered[$row->id] = $applied;
            if ($applied < $amount) {
                $unpaid[] = $row->id;
            }
        }
        // An earlier benefit may have reduced the schedule below cash received.
        // Retain that paid portion so it cannot consume the new outstanding rows.
        if ($paidRemaining > 0) {
            $covered[$installments->last()->id] += $paidRemaining;
        }
        // A higher final charge can exceed a formerly settled assessment.
        if ($outstanding > 0 && $unpaid === []) {
            $unpaid[] = $installments->last()->id;
        }
        $count = count($unpaid);
        $base = $count ? intdiv($outstanding, $count) : 0;
        $remainder = $count ? $outstanding % $count : 0;
        foreach ($installments as $row) {
            $extra = in_array($row->id, $unpaid, true) ? $base + ($remainder-- > 0 ? 1 : 0) : 0;
            $row->update(['amount' => Currency::pesos($covered[$row->id] + $extra)]);
        }
        $this->unsetRelation('installments');
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
