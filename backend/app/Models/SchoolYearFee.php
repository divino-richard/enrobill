<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['school_year_id', 'year_level', 'category', 'name', 'type', 'amount', 'sequence'])]
class SchoolYearFee extends Model
{
    /** Whether a fee item is a base charge or an extra add-on (e.g. Grade 12). */
    public const TYPES = ['default', 'add_on'];

    /** Year levels a fee item can target: every level, or a specific one. */
    public const YEAR_LEVELS = ['all', 'grade_11', 'grade_12'];

    /** Sections of the official Schedule of Fees a fee item belongs to. */
    public const CATEGORIES = ['tuition', 'miscellaneous', 'other'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'sequence' => 'integer',
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
