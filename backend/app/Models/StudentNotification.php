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
    /** Old collection reminders remain readable but no longer request payment. */
    public function isObsoleteDroppingReminder(): bool
    {
        if (str_starts_with($this->dedupe_key ?? '', 'installment-due:')) {
            $bill = BillInstallment::find((int) substr($this->dedupe_key, strlen('installment-due:')))?->bill;
        } elseif (str_starts_with($this->dedupe_key ?? '', 'arrangement-due:')) {
            $bill = Bill::find((int) explode(':', $this->dedupe_key)[1]);
        } else {
            return false;
        }

        return $bill?->student_id === $this->student_id && $bill->isDroppingBill();
    }

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
