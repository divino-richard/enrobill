<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A student's clearance and grades review for one semester. Gates the year-end
 * promote/graduate decision; grade level, enrollment and billing stay annual.
 */
#[Fillable([
    'student_id', 'school_year_id', 'semester',
    'clearance_cleared', 'clearance_note',
    'grades_passed', 'grades_note',
    'reviewed_by', 'reviewed_at',
])]
class SemesterStanding extends Model
{
    public const SEMESTERS = ['first', 'second'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'clearance_cleared' => 'boolean',
            'grades_passed' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    /** Whether this semester fully passes: cleared and with passing grades. */
    public function isMet(): bool
    {
        return $this->clearance_cleared && $this->grades_passed;
    }

    /** Whether the given document type ('clearance'|'grades') is currently accepted. */
    public function isAccepted(string $type): bool
    {
        return (bool) ($type === 'clearance' ? $this->clearance_cleared : $this->grades_passed);
    }

    /** The reason the given document type was last returned, if any. */
    public function noteFor(string $type): ?string
    {
        return $type === 'clearance' ? $this->clearance_note : $this->grades_note;
    }

    /**
     * Whether the given document type was explicitly sent back with a
     * reason — the only state that lets the student replace/remove the file.
     */
    public function isReturned(string $type): bool
    {
        return ! $this->isAccepted($type) && $this->noteFor($type) !== null;
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
    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
