<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'school_year_id', 'student_id', 'enrollment_id', 'freebie_id', 'referral_id',
    'bill_adjustment_id', 'type', 'beneficiary', 'status', 'qualified_at',
    'applied_at', 'cancelled_at',
])]
class IncentiveAward extends Model
{
    public const TYPE_EARLY_ENROLLMENT = 'early_enrollment';

    public const TYPE_REFERRAL = 'referral';

    public const BENEFICIARY_EARLY_GRADE_11 = 'early_grade_11';

    public const BENEFICIARY_REFERRED_GRADE_11 = 'referred_grade_11';

    public const BENEFICIARY_REFERRER_GRADE_12 = 'referrer_grade_12';

    public const STATUS_PENDING = 'pending';

    public const STATUS_ELIGIBLE = 'eligible';

    public const STATUS_APPLIED = 'applied';

    /** Qualified, but the bill was already fully covered/paid; no refund is due. */
    public const STATUS_APPLIED_NO_BALANCE = 'applied_no_balance';

    public const STATUS_CANCELLED = 'cancelled';

    protected function casts(): array
    {
        return [
            'qualified_at' => 'datetime',
            'applied_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function freebie(): BelongsTo
    {
        return $this->belongsTo(Freebie::class);
    }

    public function referral(): BelongsTo
    {
        return $this->belongsTo(Referral::class);
    }

    public function billAdjustment(): BelongsTo
    {
        return $this->belongsTo(BillAdjustment::class);
    }

    public function isApplied(): bool
    {
        return in_array($this->status, [self::STATUS_APPLIED, self::STATUS_APPLIED_NO_BALANCE], true);
    }
}
