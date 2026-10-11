<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['bill_id', 'name', 'category', 'dropping_component', 'source_fee_id', 'amount'])]
class BillItem extends Model
{
    public const DROPPING_COMPONENTS = ['registration', 'miscellaneous', 'laboratory', 'tuition', 'other'];

    protected static function booted(): void
    {
        static::saving(fn (BillItem $item) => $item->bill?->assertMutableAssessment());
        static::deleting(fn (BillItem $item) => $item->bill?->assertMutableAssessment());
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'source_fee_id' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Bill, $this>
     */
    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }
}
