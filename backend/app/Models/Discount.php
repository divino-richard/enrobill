<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'category', 'type', 'value', 'is_active'])]
class Discount extends Model
{
    use SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Resolve the peso credit this discount removes from a given gross amount.
     */
    public function resolveAmount(float $gross): float
    {
        $amount = $this->type === 'percentage'
            ? $gross * ((float) $this->value / 100)
            : (float) $this->value;

        // Never credit more than the gross charges.
        return round(min(max($amount, 0), $gross), 2);
    }
}
