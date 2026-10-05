<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentCreditAllocation extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'released_amount' => 'decimal:2'];
    }

    public function credit()
    {
        return $this->belongsTo(StudentCredit::class, 'credit_id');
    }

    public function bill()
    {
        return $this->belongsTo(Bill::class);
    }
}
