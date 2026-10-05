<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class DroppingAssessment extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'final_charge' => 'decimal:2'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw ValidationException::withMessages(['assessment' => 'An approved dropping assessment cannot be changed.']));
        static::deleting(fn () => throw ValidationException::withMessages(['assessment' => 'An approved dropping assessment cannot be deleted.']));
    }
}
