<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A student's request to move to a different track/strand, and the
 * registrar's decision on it.
 */
#[Fillable([
    'student_id', 'enrollment_id', 'from_program_code', 'to_program_code',
    'school_year', 'reason', 'status', 'decision_note', 'decided_by', 'decided_at',
])]
class ProgramTransferRequest extends Model
{
    public const STATUSES = ['pending', 'approved', 'rejected'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<Enrollment, $this>
     */
    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    /**
     * The admin who approved/rejected this request, if decided.
     *
     * @return BelongsTo<User, $this>
     */
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
