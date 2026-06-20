<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'name', 'category', 'sort_order', 'is_active'])]
class Program extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * The default fee items new fee structures for this program are seeded with.
     *
     * @return HasMany<ProgramFeeItem, $this>
     */
    public function feeItems(): HasMany
    {
        return $this->hasMany(ProgramFeeItem::class)->orderBy('id');
    }

    /**
     * The year levels this program offers, in display order.
     *
     * @return BelongsToMany<YearLevel, $this>
     */
    public function yearLevels(): BelongsToMany
    {
        return $this->belongsToMany(YearLevel::class)
            ->orderBy('year_levels.sort_order')
            ->orderBy('year_levels.name');
    }

    /**
     * The codes of this program's active year levels, in order.
     *
     * @return array<int, string>
     */
    public function activeYearLevelCodes(): array
    {
        return $this->yearLevels->where('is_active', true)->pluck('code')->all();
    }

    /**
     * @param  Builder<Program>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
