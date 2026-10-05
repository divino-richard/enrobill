<?php

namespace App\Models;

use App\Actions\ReferralLifecycle;
use App\Services\StudentCreditService;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Validation\ValidationException;

#[Fillable([
    'student_id', 'school_year_id', 'section_id', 'discount_id', 'track', 'year_level', 'no_downpayment', 'status', 'enrolled_at', 'created_by', 'returning_from_enrollment_id', 'dropping_category',
])]
class Enrollment extends Model
{
    protected static function booted(): void
    {
        static::updating(function (self $enrollment): void {
            if ($enrollment->isDirty('status') && $enrollment->status === 'enrolled'
                && ! $enrollment->canActivate()) {
                throw ValidationException::withMessages([
                    'status' => 'Meet this enrollment’s payment requirement and settle previous balances or record an approved payment arrangement first.',
                ]);
            }
        });
    }

    public function canActivate(): bool
    {
        $bill = $this->bill()->first();

        return $bill !== null && $bill->enrollmentDownpaymentMet()
            && app(StudentCreditService::class)->priorDebtClear($this);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enrolled_at' => 'datetime',
            'no_downpayment' => 'boolean',
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
     * The section this enrollment is placed in, if any.
     *
     * @return BelongsTo<Section, $this>
     */
    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    /**
     * The admin who created this enrollment, if any.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The voucher granted for this school year, decided when the application was
     * accepted and applied for the cashier at bill generation.
     *
     * @return BelongsTo<Discount, $this>
     */
    public function discount(): BelongsTo
    {
        return $this->belongsTo(Discount::class);
    }

    /**
     * The bill generated for this enrollment, if any.
     *
     * @return HasOne<Bill, $this>
     */
    public function bill(): HasOne
    {
        return $this->hasOne(Bill::class);
    }

    /** Incentive eligibility records attached to this school-year enrollment. */
    public function incentiveAwards(): HasMany
    {
        return $this->hasMany(IncentiveAward::class);
    }

    public function referralsAsReferrer(): HasMany
    {
        return $this->hasMany(Referral::class, 'referrer_enrollment_id');
    }

    public function referralsAsReferredStudent(): HasMany
    {
        return $this->hasMany(Referral::class, 'referred_enrollment_id');
    }

    /**
     * Mark this enrollment as enrolled (downpayment/full payment met). Idempotent.
     */
    public function markEnrolled(): void
    {
        if ($this->status === 'pending' && $this->canActivate()) {
            $this->update(['status' => 'enrolled', 'enrolled_at' => now()]);

            // Referral success is tied to the actual Grade 11 enrollment
            // milestone, regardless of whether it was reached by a payment,
            // voucher-backed incentive, or an administrative settlement.
            app(ReferralLifecycle::class)
                ->markEnrollmentSuccessful($this->fresh());
        }
    }
}
