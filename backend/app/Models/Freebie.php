<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'school_year_id', 'type', 'name', 'is_active', 'starts_on', 'ends_on', 'min_referrals',
])]
class Freebie extends Model
{
    /** The school-year promo types. */
    public const TYPES = ['early_enrollment', 'referral'];

    /** Promo types whose eligibility has exactly one grade-level target. */
    public const GRADE_FOR_TYPE = [
        'early_enrollment' => 'grade_11',
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

    public function incentiveAwards(): HasMany
    {
        return $this->hasMany(IncentiveAward::class);
    }
}
