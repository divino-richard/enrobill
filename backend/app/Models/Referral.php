<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'school_year_id', 'referral_code_id', 'referrer_student_id', 'application_id',
    'referred_student_id', 'referrer_enrollment_id', 'referred_enrollment_id',
    'status', 'claimed_by', 'updated_by', 'accepted_by', 'cancelled_by',
    'cancellation_reason', 'claimed_at', 'accepted_at', 'successful_at',
    'cancelled_at',
])]
class Referral extends Model
{
    public const STATUS_CLAIMED = 'claimed';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_SUCCESSFUL = 'successful';

    public const STATUS_CANCELLED = 'cancelled';

    /** Explicit registrar resolution; application retries must not reopen it. */
    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [
        self::STATUS_CLAIMED,
        self::STATUS_ACCEPTED,
        self::STATUS_SUCCESSFUL,
        self::STATUS_CANCELLED,
        self::STATUS_CLOSED,
    ];

    protected function casts(): array
    {
        return [
            'claimed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'successful_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function targetSchoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class, 'school_year_id');
    }

    public function referralCode(): BelongsTo
    {
        return $this->belongsTo(ReferralCode::class);
    }

    public function referrerStudent(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'referrer_student_id');
    }

    public function referredApplication(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'application_id');
    }

    public function referredStudent(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'referred_student_id');
    }

    /** The referrer's rewarded Grade 12 enrollment in the target school year. */
    public function referrerEnrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class, 'referrer_enrollment_id');
    }

    /** The new student's Grade 11 enrollment in the target school year. */
    public function referredEnrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class, 'referred_enrollment_id');
    }

    public function incentiveAwards(): HasMany
    {
        return $this->hasMany(IncentiveAward::class);
    }

    public function claimant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'claimed_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function accepter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function isMutableClaim(): bool
    {
        return in_array($this->status, [self::STATUS_CLAIMED, self::STATUS_CANCELLED], true);
    }
}
