<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id', 'reference', 'status', 'decision_note',
    'enrollment_type',
    'surname', 'given_name', 'middle_name', 'extension', 'date_of_birth',
    'age', 'gender', 'nationality', 'civil_status', 'place_of_birth',
    'religion', 'health_concerns',
    'address_street', 'address_barangay', 'address_city', 'address_province',
    'home_address', 'mailing_address', 'phone_number', 'email_address',
    'facebook_account',
    'guardian_name', 'guardian_relation', 'guardian_contact_number',
    'guardian_address', 'guardian_occupation',
    'prev_school_name', 'prev_school_grade_level', 'prev_school_address',
    'prev_school_year_graduated', 'prev_school_gpa', 'prev_school_type',
    'document_promissory_note', 'document_promissory_date',
    'track_or_strand', 'year_level', 'semester', 'school_year',
    'declaration_student_name', 'declaration_guardian_name', 'date_signed',
    'agreement_accepted', 'submitted_at',
])]
class Application extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'document_promissory_date' => 'date',
            'age' => 'integer',
            'agreement_accepted' => 'boolean',
            'date_signed' => 'datetime',
            'submitted_at' => 'datetime',
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
     * @return HasMany<ApplicationDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(ApplicationDocument::class);
    }
}
