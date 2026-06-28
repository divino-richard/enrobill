<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'school_year', 'current_semester', 'start_date', 'end_date', 'is_active', 'admission_open',
    'downpayment_type', 'downpayment_value', 'installment_count',
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
            'start_date' => 'date',
            'end_date' => 'date',
            'is_active' => 'boolean',
            'admission_open' => 'boolean',
            'downpayment_value' => 'decimal:2',
        ];
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
            ->first();
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
}
