<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id', 'application_id', 'student_number', 'status',
    'first_name', 'middle_name', 'last_name', 'extension', 'date_of_birth',
    'gender', 'nationality', 'civil_status', 'place_of_birth', 'religion',
    'email', 'phone_number',
    'address_province', 'address_city', 'address_barangay', 'address_street',
    'track_or_strand', 'year_level', 'school_year',
])]
class Student extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The application that admitted this student.
     *
     * @return BelongsTo<Application, $this>
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * @return HasMany<Bill, $this>
     */
    public function bills(): HasMany
    {
        return $this->hasMany(Bill::class);
    }

    /**
     * The student's per-term enrollments (academic record).
     *
     * @return HasMany<Enrollment, $this>
     */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    /**
     * The year-end progression decisions recorded for this student.
     *
     * @return HasMany<ProgressionDecision, $this>
     */
    public function progressionDecisions(): HasMany
    {
        return $this->hasMany(ProgressionDecision::class);
    }

    /**
     * Keep the student's global status as a convenience mirror of their latest
     * enrollment (the open term if billed, else the most recent). Statuses that
     * aren't enrollment-driven (graduated/inactive) are left untouched.
     */
    public function syncStatusFromLatestEnrollment(): void
    {
        $latest = $this->enrollments()
            ->with('schoolYear')
            ->get()
            ->sortByDesc(fn (Enrollment $e) => $e->schoolYear?->school_year ?? '')
            ->first();

        if ($latest === null) {
            return;
        }

        $mirror = match ($latest->status) {
            'enrolled' => 'enrolled',
            'dropped' => 'dropped',
            'completed' => 'graduated',
            'withdrawn' => 'inactive',
            default => 'admitted', // pending
        };

        if ($this->status !== $mirror) {
            $this->update(['status' => $mirror]);
        }
    }
}
