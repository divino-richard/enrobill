<?php

namespace App\Http\Controllers;

use App\Models\ClassTimetable;
use App\Models\SchoolYear;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentScheduleController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $input = $request->validate(['enrollmentId' => ['sometimes', 'integer', 'min:1']]);
        $student = $request->user()->student;
        abort_if($student === null, 404, 'No student record found.');
        $query = $student->enrollments()->with(['section', 'schoolYear']);
        if (isset($input['enrollmentId'])) {
            $enrollment = $query->whereKey($input['enrollmentId'])->firstOrFail();
        } else {
            $records = $query->get();
            $enrollment = $records->firstWhere('school_year_id', SchoolYear::active()?->id)
                ?? $records->sortByDesc(fn ($record) => $record->schoolYear?->school_year)->first();
        }
        $section = $enrollment?->section;
        $timetable = $section ? ClassTimetable::where('section_id', $section->id)->first() : null;
        $status = ! $enrollment ? 'no_enrollment' : (! $section ? 'no_section' : (! $timetable?->published_at ? 'not_published' : 'published'));
        $entries = $status === 'published'
            ? $this->currentTeacherNames($timetable->published_entries ?? [])
            : [];

        return response()->json(['data' => [
            'enrollmentId' => $enrollment?->id,
            'schoolYear' => $enrollment?->schoolYear?->school_year,
            'section' => $section ? ['id' => $section->id, 'name' => $section->name, 'program' => $section->program, 'yearLevel' => $section->year_level] : null,
            'status' => $status,
            'publishedAt' => $timetable?->published_at?->toIso8601String(),
            'entries' => $entries,
        ]]);
    }

    private function currentTeacherNames(array $entries): array
    {
        $teachers = User::query()
            ->whereIn('id', collect($entries)->pluck('teacherId')->filter())
            ->where('role', 'teacher')
            ->pluck('name', 'id');

        foreach ($entries as &$entry) {
            $currentName = $teachers->get((int) ($entry['teacherId'] ?? 0));
            if ($currentName !== null) {
                $entry['teacher'] = $currentName;
            }
        }
        unset($entry);

        return $entries;
    }
}
