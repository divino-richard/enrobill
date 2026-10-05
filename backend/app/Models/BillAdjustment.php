<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['bill_id', 'discount_id', 'incentive_key', 'label', 'type', 'value', 'amount'])]
class BillAdjustment extends Model
{
    protected static function booted(): void
    {
        static::saving(fn (BillAdjustment $adjustment) => $adjustment->bill?->assertMutableAssessment());
        static::deleting(fn (BillAdjustment $adjustment) => $adjustment->bill?->assertMutableAssessment());
    }

    /** One shared credit per bill, regardless of how many awards qualified. */
    public const INCENTIVE_KEY_ZERO_TUITION = 'zero_tuition';

    /** Keep qualification reasons available anywhere an adjustment is rendered. */
    protected $with = ['incentiveAwards.freebie'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Bill, $this>
     */
    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    /**
     * @return BelongsTo<Discount, $this>
     */
    public function discount(): BelongsTo
    {
        return $this->belongsTo(Discount::class);
    }

    /** Awards represented by this shared incentive credit. */
    public function incentiveAwards(): HasMany
    {
        return $this->hasMany(IncentiveAward::class);
    }
}
