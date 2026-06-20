<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
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
     * @param  Builder<Program>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }
}
