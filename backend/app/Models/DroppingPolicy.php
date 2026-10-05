<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DroppingPolicy extends Model
{
    public const PERIODS = ['enrollment', 'quarter_1', 'quarter_2', 'quarter_3', 'quarter_4'];

    public const FORMULAS = [
        'paying' => [
            'enrollment' => ['registration' => 100],
            'quarter_1' => ['miscellaneous' => 100, 'laboratory' => 100],
            'quarter_2' => ['miscellaneous' => 100, 'laboratory' => 100, 'tuition' => 50],
            'quarter_3' => ['total' => 100], 'quarter_4' => ['total' => 100],
        ],
        'voucher_esc' => [
            'enrollment' => ['registration' => 100], 'quarter_1' => ['miscellaneous' => 50],
            'quarter_2' => ['miscellaneous' => 100],
            'quarter_3' => ['miscellaneous' => 100, 'laboratory' => 100],
            'quarter_4' => ['total' => 50],
        ],
    ];

    protected static function booted(): void
    {
        static::creating(function (DroppingPolicy $policy) {
            $policy->formulas ??= self::FORMULAS;
        });
    }

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['periods' => 'array', 'formulas' => 'array', 'enabled' => 'boolean', 'version' => 'integer'];
    }
}
