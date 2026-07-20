<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'student_id',
    'school_year_id',
    'semester',
    'type',
    's3_key',
    'file_name',
    'size',
    'content_type',
])]
class StudentDocument extends Model
{
    /** The semesters a document can belong to, in academic order. */
    public const SEMESTERS = ['first', 'second'];

    /** What a student uploads each semester for year-end evaluation. */
    public const TYPES = ['clearance', 'grades'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'size' => 'integer',
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
     * @return BelongsTo<SchoolYear, $this>
     */
    public function schoolYear(): BelongsTo
    {
        return $this->belongsTo(SchoolYear::class);
    }
}
