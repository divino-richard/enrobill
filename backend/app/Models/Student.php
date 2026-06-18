<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
