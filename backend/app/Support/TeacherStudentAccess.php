<?php

namespace App\Support;

use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Collection;

class TeacherStudentAccess
{
    /**
     * School years where this teacher is assigned as a section adviser.
     *
     * @return Collection<int, SchoolYear>
     */
    public function schoolYears(User $teacher): Collection
    {
        return Section::query()
            ->where('adviser_teacher_id', $teacher->id)
            ->with('schoolYear')
            ->get()
            ->map(fn (Section $section) => $section->schoolYear)
            ->filter()
            ->unique('id')
            ->sortByDesc('school_year')
            ->values();
    }

    /**
     * Sections where this teacher is the assigned adviser.
     *
     * @return Collection<int, int>
     */
    public function sectionIds(User $teacher, SchoolYear $schoolYear): Collection
    {
        return Section::query()
            ->where('school_year_id', $schoolYear->id)
            ->where('adviser_teacher_id', $teacher->id)
            ->pluck('id')
            ->values();
    }

    public function handles(User $teacher, Student $student, SchoolYear $schoolYear): bool
    {
        $sectionIds = $this->sectionIds($teacher, $schoolYear);

        if ($sectionIds->isEmpty()) {
            return false;
        }

        return Enrollment::query()
            ->where('student_id', $student->id)
            ->where('school_year_id', $schoolYear->id)
            ->where('status', 'enrolled')
            ->whereIn('section_id', $sectionIds)
            ->exists();
    }
}
