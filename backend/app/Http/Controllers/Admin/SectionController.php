<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SectionResource;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Section;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SectionController extends Controller
{
    /**
     * Sections for a school year (defaults to the active one), with their rosters
     * and occupancy. Optionally filtered by program and grade.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $schoolYearId = $this->scopeSchoolYearId($request);

        $sections = Section::query()
            ->when($schoolYearId, fn ($q) => $q->where('school_year_id', $schoolYearId))
            ->when($request->filled('program'), fn ($q) => $q->where('program', $request->string('program')->value()))
            ->when($request->filled('yearLevel'), fn ($q) => $q->where('year_level', $request->string('yearLevel')->value()))
            ->with(['enrollments' => fn ($q) => $q->with('student')->orderBy('id')])
            ->orderBy('program')
            ->orderBy('year_level')
            ->orderBy('name')
            ->get();

        return SectionResource::collection($sections);
    }

    /**
     * Enrolled students in scope who haven't been placed in a section yet.
     */
    public function unsectioned(Request $request): JsonResponse
    {
        $schoolYearId = $this->scopeSchoolYearId($request);

        $students = Enrollment::query()
            ->where('status', 'enrolled')
            ->whereNull('section_id')
            ->when($schoolYearId, fn ($q) => $q->where('school_year_id', $schoolYearId))
            ->when($request->filled('program'), fn ($q) => $q->where('track', $request->string('program')->value()))
            ->when($request->filled('yearLevel'), fn ($q) => $q->where('year_level', $request->string('yearLevel')->value()))
            ->with('student')
            ->get()
            ->map(fn (Enrollment $enrollment) => [
                'enrollmentId' => $enrollment->id,
                'studentId' => $enrollment->student_id,
                'studentNumber' => $enrollment->student?->student_number,
                'name' => trim(($enrollment->student?->first_name ?? '').' '.($enrollment->student?->last_name ?? '')),
                'program' => $enrollment->track,
                'yearLevel' => $enrollment->year_level,
            ])
            ->values();

        return response()->json(['data' => $students]);
    }

    public function store(Request $request): SectionResource
    {
        $validated = $request->validate([
            'schoolYearId' => ['required', 'integer', 'exists:school_years,id'],
            'program' => ['required', 'string', 'exists:programs,code'],
            'yearLevel' => ['required', Rule::in(SchoolYear::YEAR_LEVELS)],
            'name' => [
                'required', 'string', 'max:50',
                Rule::unique('sections', 'name')->where(fn ($q) => $q
                    ->where('school_year_id', $request->integer('schoolYearId'))
                    ->where('program', $request->string('program')->value())
                    ->where('year_level', $request->string('yearLevel')->value())),
            ],
            'capacity' => ['required', 'integer', 'min:1', 'max:500'],
        ], [
            'name.unique' => 'A section with this name already exists for this program and grade.',
        ]);

        $section = Section::create([
            'school_year_id' => $validated['schoolYearId'],
            'program' => $validated['program'],
            'year_level' => $validated['yearLevel'],
            'name' => $validated['name'],
            'capacity' => $validated['capacity'],
        ]);

        return new SectionResource($section->load('enrollments.student'));
    }

    public function update(Request $request, Section $section): SectionResource
    {
        $validated = $request->validate([
            'name' => [
                'required', 'string', 'max:50',
                Rule::unique('sections', 'name')->ignore($section->id)->where(fn ($q) => $q
                    ->where('school_year_id', $section->school_year_id)
                    ->where('program', $section->program)
                    ->where('year_level', $section->year_level)),
            ],
            'capacity' => ['required', 'integer', 'min:1', 'max:500'],
        ], [
            'name.unique' => 'A section with this name already exists for this program and grade.',
        ]);

        $section->update($validated);

        return new SectionResource($section->load('enrollments.student'));
    }

    public function destroy(Section $section): Response
    {
        // Enrolled students are unassigned (section_id nulled) by the FK.
        $section->delete();

        return response()->noContent();
    }

    /**
     * Place (or move/unassign) an enrollment in a section.
     */
    public function assign(Request $request, Enrollment $enrollment): JsonResponse
    {
        $validated = $request->validate([
            'sectionId' => ['present', 'nullable', 'integer', 'exists:sections,id'],
        ]);

        if ($validated['sectionId'] === null) {
            $enrollment->update(['section_id' => null]);

            return response()->json(['data' => ['sectionId' => null]]);
        }

        $section = Section::findOrFail($validated['sectionId']);

        if (
            $section->school_year_id !== $enrollment->school_year_id
            || $section->program !== $enrollment->track
            || $section->year_level !== $enrollment->year_level
        ) {
            throw ValidationException::withMessages([
                'sectionId' => 'That section is for a different school year, program or grade.',
            ]);
        }

        $occupied = $section->enrollments()->whereKeyNot($enrollment->id)->count();
        if ($occupied >= $section->capacity) {
            throw ValidationException::withMessages([
                'sectionId' => 'That section is already full.',
            ]);
        }

        $enrollment->update(['section_id' => $section->id]);

        return response()->json(['data' => ['sectionId' => $section->id]]);
    }

    private function scopeSchoolYearId(Request $request): ?int
    {
        return $request->integer('schoolYearId') ?: SchoolYear::active()?->id;
    }
}
