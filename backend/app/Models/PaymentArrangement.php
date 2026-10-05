<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentArrangement extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['installments' => 'array', 'starting_paid' => 'decimal:2'];
    }

    public function bill()
    {
        return $this->belongsTo(Bill::class);
    }
}
