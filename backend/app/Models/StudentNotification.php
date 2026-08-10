<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'student_id', 'category', 'title', 'message', 'cta_label', 'cta_url',
    'action_required', 'dedupe_key', 'read_at',
])]
class StudentNotification extends Model
{
    public const CATEGORIES = [
        'billing', 'enrollment', 'applications', 'documents', 'transfer', 'progression', 'account',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'action_required' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
