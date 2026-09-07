<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'school_year_id', 'referrer_student_id', 'qualifying_enrollment_id',
    'issued_by', 'code', 'is_active',
])]
class ReferralCode extends Model
{
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** The upcoming school year in which this code may be claimed. */
    public function targetSchoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class, 'school_year_id');
    }

    /** The student who owns and may reuse this code. */
    public function referrer(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'referrer_student_id');
    }

    /** The prior-year enrolled Grade 11 record that qualified the owner. */
    public function qualifyingEnrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class, 'qualifying_enrollment_id');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class);
    }
}
