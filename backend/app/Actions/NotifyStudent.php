<?php

namespace App\Actions;

use App\Models\Student;
use App\Models\StudentNotification;

/**
 * Writes one row to a student's notification inbox. The single call site every
 * trigger (payments, enrollment changes, document review, transfers, progression,
 * account changes) goes through, so "what counts as a notification" stays in one
 * place. Pass a dedupeKey for recurring sources (e.g. the installment due-date
 * reminder) so re-running the source doesn't re-notify for the same thing.
 */
class NotifyStudent
{
    public function __invoke(
        Student|int $student,
        string $category,
        string $title,
        string $message,
        ?string $ctaLabel = null,
        ?string $ctaUrl = null,
        bool $actionRequired = false,
        ?string $dedupeKey = null,
    ): StudentNotification {
        $attributes = [
            'student_id' => $student instanceof Student ? $student->id : $student,
            'category' => $category,
            'title' => $title,
            'message' => $message,
            'cta_label' => $ctaLabel,
            'cta_url' => $ctaUrl,
            'action_required' => $actionRequired,
        ];

        if ($dedupeKey !== null) {
            return StudentNotification::firstOrCreate(['dedupe_key' => $dedupeKey], $attributes);
        }

        return StudentNotification::create($attributes);
    }
}
