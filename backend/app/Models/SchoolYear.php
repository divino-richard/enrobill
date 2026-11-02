<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

#[Fillable([
    'school_year', 'start_date', 'end_date', 'is_active', 'admission_open',
    'progression_open', 'downpayment_value', 'installment_count', 'fees_published_at',
])]
class SchoolYear extends Model
{
    /** The fixed SHS year levels a student can hold (fees may also target 'all'). */
    public const YEAR_LEVELS = ['grade_11', 'grade_12'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fees_published_at' => 'datetime',
            'start_date' => 'date',
            'end_date' => 'date',
            'is_active' => 'boolean',
            'admission_open' => 'boolean',
            'progression_open' => 'boolean',
            'downpayment_value' => 'decimal:2',
        ];
    }

    public function assertFeesDraft(): void
    {
        if ($this->fees_published_at !== null) {
            throw ValidationException::withMessages([
                'fees' => 'Return this fee schedule to draft before editing. Admissions will close until the fees are republished.',
            ]);
        }
    }

    /**
     * The school year the system currently operates on (bills, portal, dashboard).
     */
    public static function active(): ?self
    {
        return static::query()->where('is_active', true)->first();
    }

    /**
     * The active school year, but only while it's accepting new applications.
     */
    public static function admitting(): ?self
    {
        return static::query()
            ->where('is_active', true)
            ->where('admission_open', true)
            ->whereNotNull('fees_published_at')
            ->first();
    }

    /**
     * Whether the schedule alone would open progression: the year has reached or
     * passed its end date. Independent of the manual override and active state.
     */
    public function autoProgressionOpen(): bool
    {
        return $this->end_date !== null
            && now()->startOfDay()->greaterThanOrEqualTo($this->end_date);
    }

    /**
     * The effective progression state. Progression only ever runs on the active
     * year. From there the manual override wins when set (true/false); otherwise
     * it follows the end-date schedule.
     */
    public function isProgressionOpen(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        return $this->progression_open ?? $this->autoProgressionOpen();
    }

    /**
     * @param  Builder<SchoolYear>  $query
     */
    public function scopeNewestFirst(Builder $query): void
    {
        $query->orderByDesc('school_year');
    }

    /**
     * @return HasMany<Enrollment, $this>
     */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    /**
     * The bills generated for this school year.
     *
     * @return HasMany<Bill, $this>
     */
    public function bills(): HasMany
    {
        return $this->hasMany(Bill::class);
    }

    /**
     * The global fee schedule for this school year.
     *
     * @return HasMany<SchoolYearFee, $this>
     */
    public function fees(): HasMany
    {
        return $this->hasMany(SchoolYearFee::class);
    }

    /**
     * The promos (freebies) configured for this school year.
     *
     * @return HasMany<Freebie, $this>
     */
    public function freebies(): HasMany
    {
        return $this->hasMany(Freebie::class);
    }

    public function referralCodes(): HasMany
    {
        return $this->hasMany(ReferralCode::class);
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class);
    }

    public function incentiveAwards(): HasMany
    {
        return $this->hasMany(IncentiveAward::class);
    }
}
