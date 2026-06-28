<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'student_id', 'from_school_year_id', 'decision', 'from_year_level', 'to_year_level',
    'to_school_year_id', 'to_enrollment_id', 'decided_by', 'decided_at', 'materialized_at',
])]
class ProgressionDecision extends Model
{
    /** The terminal/continuing outcomes an admin can record at year-end. */
    public const DECISIONS = ['promote', 'retain', 'graduate'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
            'materialized_at' => 'datetime',
        ];
    }

    /**
     * Whether this decision still needs a next-year enrollment created for it.
     * Only promote/retain ever materialize; graduate is terminal.
     */
    public function needsMaterialization(): bool
    {
        return in_array($this->decision, ['promote', 'retain'], true)
            && $this->materialized_at === null;
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<SchoolYear, $this>
     */
    public function fromSchoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class, 'from_school_year_id');
    }

    /**
     * @return BelongsTo<SchoolYear, $this>
     */
    public function toSchoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class, 'to_school_year_id');
    }

    /**
     * The next-year enrollment created when the decision was materialized, if any.
     *
     * @return BelongsTo<Enrollment, $this>
     */
    public function toEnrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class, 'to_enrollment_id');
    }
}
