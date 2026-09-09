<?php

namespace App\Http\Controllers;

use App\Models\ClassTimetable;
use App\Models\SchoolYear;
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

        return response()->json(['data' => [
            'enrollmentId' => $enrollment?->id,
            'schoolYear' => $enrollment?->schoolYear?->school_year,
            'section' => $section ? ['id' => $section->id, 'name' => $section->name, 'program' => $section->program, 'yearLevel' => $section->year_level] : null,
            'status' => $status,
            'publishedAt' => $timetable?->published_at?->toIso8601String(),
            'entries' => $status === 'published' ? ($timetable->published_entries ?? []) : [],
        ]]);
    }
}
