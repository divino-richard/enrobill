<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'school_year_id', 'type', 'name', 'is_active', 'starts_on', 'ends_on', 'min_referrals',
])]
class Freebie extends Model
{
    /** The promo types. early_enrollment is live; referral is scaffolded for later. */
    public const TYPES = ['early_enrollment', 'referral'];

    /** The year level each promo type applies to. */
    public const GRADE_FOR_TYPE = [
        'early_enrollment' => 'grade_11',
        'referral' => 'grade_12',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'starts_on' => 'date',
            'ends_on' => 'date',
            'min_referrals' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<SchoolYear, $this>
     */
    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }
}
