<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['term_id', 'track', 'year_level'])]
class FeeStructure extends Model
{
    /** The fixed SHS year levels a fee structure can target. */
    public const YEAR_LEVELS = ['grade_11', 'grade_12'];

    /**
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * @return HasMany<FeeStructureItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(FeeStructureItem::class);
    }
}
