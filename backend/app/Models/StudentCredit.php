<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudentCredit extends Model
{
    public const EXCESS_PAYMENT = 'excess_payment';

    public const RETURNING_STUDENT = 'returning_student';

    protected $guarded = ['id'];

    public function label(): string
    {
        return $this->kind === self::RETURNING_STUDENT ? 'Returning student credit' : 'Excess payment credit';
    }

    protected function casts(): array
    {
        return ['amount' => 'decimal:2'];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(StudentCreditAllocation::class, 'credit_id');
    }

    public function sourceBill()
    {
        return $this->belongsTo(Bill::class, 'source_bill_id');
    }

    public function remaining(): float
    {
        return max(0, round((float) $this->amount - (float) $this->allocations()->sum('amount') + (float) $this->allocations()->sum('released_amount'), 2));
    }
}
