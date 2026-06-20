<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'school_year', 'semester', 'start_date', 'end_date', 'is_open',
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
            'is_open' => 'boolean',
            'installments_enabled' => 'boolean',
            'downpayment_value' => 'decimal:2',
        ];
    }

    /**
     * The currently open enrollment term, if any.
     */
    public static function open(): ?self
    {
        return static::query()->where('is_open', true)->first();
    }

    /**
     * @param  Builder<Term>  $query
     */
    public function scopeNewestFirst(Builder $query): void
    {
        $query->orderByDesc('school_year')->orderBy('semester');
    }
}
