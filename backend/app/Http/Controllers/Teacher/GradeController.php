<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentDocumentResource;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\SemesterStanding;
use App\Models\Student;
use App\Models\StudentDocument;
use App\Support\TeacherStudentAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GradeController extends Controller
{
    private const ALLOWED_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'application/pdf' => 'pdf',
    ];

    private const MAX_BYTES = 10 * 1024 * 1024;

    public function __construct(private TeacherStudentAccess $access) {}

    public function index(Request $request): JsonResponse
    {
        $availableYears = $this->access->schoolYears($request->user());
        $requestedYearId = $request->integer('schoolYearId');
        if ($requestedYearId > 0) {
            $schoolYear = $availableYears->firstWhere('id', $requestedYearId);
            abort_if($schoolYear === null, 404);
        } else {
            $activeYear = SchoolYear::active();
            $schoolYear = $availableYears->firstWhere('id', $activeYear?->id)
                ?? $availableYears->first()
                ?? $activeYear;
            abort_if($schoolYear === null, 422, 'No school year is currently available.');
        }
        $sectionIds = $this->access->sectionIds($request->user(), $schoolYear);

        $enrollments = Enrollment::query()
            ->where('school_year_id', $schoolYear->id)
            ->where('status', 'enrolled')
            ->whereIn('section_id', $sectionIds)
            ->with(['section', 'student.documents' => fn ($query) => $query
                ->where('school_year_id', $schoolYear->id)
                ->where('type', 'grades')])
            ->get()
            ->sortBy(fn (Enrollment $enrollment) => sprintf(
                '%s|%s|%s',
                $enrollment->section?->name,
                $enrollment->student?->last_name,
                $enrollment->student?->first_name,
            ));

        $standings = SemesterStanding::query()
            ->where('school_year_id', $schoolYear->id)
            ->whereIn('student_id', $enrollments->pluck('student_id'))
            ->get()
            ->groupBy('student_id');

        $sections = $enrollments->groupBy('section_id')->map(function ($rows) use ($standings) {
            $section = $rows->first()->section;

            return [
                'id' => $section->id,
                'name' => $section->name,
                'program' => $section->program,
                'yearLevel' => $section->year_level,
                'students' => $rows->map(function (Enrollment $enrollment) use ($standings) {
                    $student = $enrollment->student;
                    $studentStandings = $standings->get($student->id, collect())->keyBy('semester');
                    $documents = $student->documents->each(function (StudentDocument $document) use ($studentStandings) {
                        $standing = $studentStandings->get($document->semester);
                        $document->review_status = $standing?->isAccepted('grades')
                            ? 'accepted'
                            : ($standing?->noteFor('grades') ? 'returned' : 'pending');
                        $document->review_note = $standing?->noteFor('grades');
                    });

                    return [
                        'id' => $student->id,
                        'studentNumber' => $student->student_number,
                        'name' => trim($student->first_name.' '.$student->last_name),
                        'documents' => StudentDocumentResource::collection($documents),
                    ];
                })->values(),
            ];
        })->values();

        return response()->json(['data' => [
            'schoolYearId' => $schoolYear->id,
            'schoolYear' => $schoolYear->school_year,
            'schoolYears' => $availableYears->map(fn (SchoolYear $year) => [
                'id' => $year->id,
                'schoolYear' => $year->school_year,
                'isActive' => $year->is_active,
            ])->values(),
            'sections' => $sections,
        ]]);
    }

    public function presign(Request $request, Student $student): JsonResponse
    {
        $validated = $request->validate([
            'school_year_id' => ['required', 'integer', Rule::exists('school_years', 'id')],
            'semester' => ['required', Rule::in(StudentDocument::SEMESTERS)],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ]);
        $schoolYear = $this->authorizeStudent($request, $student, $validated['school_year_id']);
        $this->assertSlotWritable($student, $schoolYear, $validated['semester']);
        $key = sprintf(
            'students/%s/%s/%s/grades/teacher-%s/%s.%s',
            $student->id,
            $schoolYear->id,
            $validated['semester'],
            $request->user()->id,
            Str::uuid()->toString(),
            self::ALLOWED_TYPES[$validated['content_type']],
        );
        $signed = Storage::disk('s3')->temporaryUploadUrl(
            $key,
            now()->addMinutes(10),
            ['ContentType' => $validated['content_type']],
        );

        return response()->json([
            'key' => $key,
            'url' => $signed['url'],
            'headers' => $signed['headers'],
        ]);
    }

    public function store(Request $request, Student $student): StudentDocumentResource
    {
        $validated = $request->validate([
            'school_year_id' => ['required', 'integer', Rule::exists('school_years', 'id')],
            'semester' => ['required', Rule::in(StudentDocument::SEMESTERS)],
            'key' => ['required', 'string'],
            'file_name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
        ]);
        $schoolYear = $this->authorizeStudent($request, $student, $validated['school_year_id']);
        $prefix = sprintf(
            'students/%s/%s/%s/grades/teacher-%s/',
            $student->id,
            $schoolYear->id,
            $validated['semester'],
            $request->user()->id,
        );
        abort_unless(str_starts_with($validated['key'], $prefix), 422, 'Unrecognized upload.');

        [$existing, $standing] = $this->assertSlotWritable($student, $schoolYear, $validated['semester']);
        $disk = Storage::disk('s3');
        abort_unless($disk->exists($validated['key']), 422, 'The uploaded grade slip could not be found. Upload it again.');
        abort_unless($disk->size($validated['key']) === $validated['size'], 422, 'The uploaded file size does not match. Upload it again.');
        abort_unless($disk->mimeType($validated['key']) === $validated['content_type'], 422, 'The uploaded file type does not match. Upload it again.');

        $supersededKey = $existing?->s3_key;

        $document = $student->documents()->updateOrCreate(
            [
                'school_year_id' => $schoolYear->id,
                'semester' => $validated['semester'],
                'type' => 'grades',
            ],
            [
                's3_key' => $validated['key'],
                'file_name' => $validated['file_name'],
                'size' => $validated['size'],
                'content_type' => $validated['content_type'],
            ],
        );

        if ($standing?->noteFor('grades') !== null) {
            $standing->update(['grades_note' => null]);
        }

        if ($supersededKey !== null && $supersededKey !== $validated['key']) {
            $disk->delete($supersededKey);
        }

        return new StudentDocumentResource($document);
    }

    private function authorizeStudent(Request $request, Student $student, int $schoolYearId): SchoolYear
    {
        $schoolYear = SchoolYear::findOrFail($schoolYearId);
        abort_unless($this->access->handles($request->user(), $student, $schoolYear), 404);

        return $schoolYear;
    }

    /**
     * @return array{0: StudentDocument|null, 1: SemesterStanding|null}
     */
    private function assertSlotWritable(Student $student, SchoolYear $schoolYear, string $semester): array
    {
        $existing = $student->documents()
            ->where('school_year_id', $schoolYear->id)
            ->where('semester', $semester)
            ->where('type', 'grades')
            ->first();
        $standing = SemesterStanding::query()
            ->where('student_id', $student->id)
            ->where('school_year_id', $schoolYear->id)
            ->where('semester', $semester)
            ->first();

        if ($existing !== null) {
            abort_unless(
                $standing?->isReturned('grades') ?? false,
                422,
                'This grade slip is locked. It can only be replaced after an admin returns it with a reason.',
            );
        }

        return [$existing, $standing];
    }
}
