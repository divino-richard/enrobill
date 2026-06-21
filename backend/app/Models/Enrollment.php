<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'student_id', 'term_id', 'track', 'year_level', 'status', 'enrolled_at', 'created_by',
])]
class Enrollment extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enrolled_at' => 'datetime',
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
     * @return BelongsTo<Term, $this>
     */
    public function term(): BelongsTo
    {
        return $this->belongsTo(Term::class);
    }

    /**
     * The admin who created this enrollment, if any.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The bill generated for this enrollment, if any.
     *
     * @return HasOne<Bill, $this>
     */
    public function bill(): HasOne
    {
        return $this->hasOne(Bill::class);
    }

    /**
     * Mark this enrollment as enrolled (downpayment/full payment met). Idempotent.
     */
    public function markEnrolled(): void
    {
        if ($this->status === 'pending') {
            $this->update(['status' => 'enrolled', 'enrolled_at' => now()]);
        }
    }
}
