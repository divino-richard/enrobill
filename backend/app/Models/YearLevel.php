<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['code', 'name', 'sort_order', 'is_active'])]
class YearLevel extends Model
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
     * @param  Builder<YearLevel>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('name');
    }

    /**
     * Active year level codes, ordered — the levels fee structures are generated
     * for.
     *
     * @return array<int, string>
     */
    public static function activeCodes(): array
    {
        return static::query()->ordered()->where('is_active', true)->pluck('code')->all();
    }
}
