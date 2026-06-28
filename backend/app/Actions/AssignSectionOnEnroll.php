<?php

namespace App\Actions;

use App\Models\Enrollment;
use App\Models\Section;

class AssignSectionOnEnroll
{
    /**
     * Place a freshly-enrolled student into the first matching section that still
     * has space — same school year, program and grade. No-op if the enrollment
     * isn't enrolled, is already sectioned, or no matching section has room (the
     * admin can then create one or assign manually).
     */
    public function __invoke(Enrollment $enrollment): void
    {
        if ($enrollment->status !== 'enrolled' || $enrollment->section_id !== null) {
            return;
        }

        $section = Section::query()
            ->where('school_year_id', $enrollment->school_year_id)
            ->where('program', $enrollment->track)
            ->where('year_level', $enrollment->year_level)
            ->withCount('enrollments')
            ->orderBy('name')
            ->get()
            ->first(fn (Section $s) => $s->enrollments_count < $s->capacity);

        if ($section !== null) {
            $enrollment->update(['section_id' => $section->id]);
        }
    }
}
