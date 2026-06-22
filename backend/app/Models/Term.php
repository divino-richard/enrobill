<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'school_year', 'semester', 'start_date', 'end_date', 'is_active', 'admission_open',
    'installments_enabled', 'downpayment_type', 'downpayment_value', 'installment_count',
])]
class Term extends Model
{
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
            'installments_enabled' => 'boolean',
            'downpayment_value' => 'decimal:2',
        ];
    }

    /**
     * The term the system currently operates on (bills, portal, dashboard).
     */
    public static function active(): ?self
    {
        return static::query()->where('is_active', true)->first();
    }

    /**
     * The active term, but only while it's accepting new applications.
     */
    public static function admitting(): ?self
    {
        return static::query()
            ->where('is_active', true)
            ->where('admission_open', true)
            ->first();
    }

    /**
     * @param  Builder<Term>  $query
     */
    public function scopeNewestFirst(Builder $query): void
    {
        $query->orderByDesc('school_year')->orderBy('semester');
    }

    /**
     * @return HasMany<Enrollment, $this>
     */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }
}
