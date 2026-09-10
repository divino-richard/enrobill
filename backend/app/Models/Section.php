<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'school_year_id', 'program', 'year_level', 'name', 'capacity', 'adviser_teacher_id',
])]
class Section extends Model
{
    /**
     * Students per section. Used as the cap for auto-generated sections — once a
     * grade's sections are full, the next lettered section opens at this size.
     */
    public const DEFAULT_CAPACITY = 30;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<SchoolYear, $this>
     */
    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }

    /**
     * The teacher responsible for this section's consolidated grade slips.
     *
     * @return BelongsTo<User, $this>
     */
    public function adviser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adviser_teacher_id');
    }

    /**
     * The enrollments placed in this section.
     *
     * @return HasMany<Enrollment, $this>
     */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }
}
