<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Resources\StudentDocumentResource;
use App\Models\ProgressionDecision;
use App\Models\SchoolYear;
use App\Models\SemesterStanding;
use App\Models\Student;
use App\Models\StudentDocument;
use App\Support\TeacherStudentAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StudentDocumentController extends Controller
{
    /**
     * Accepted MIME types mapped to their canonical file extension. Mirrors the
     * application-document rules.
     */
    private const ALLOWED_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'application/pdf' => 'pdf',
    ];

    private const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    /**
     * The authenticated student's uploaded clearance and grade slips for the
     * active school year, one per semester/type slot.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $student = $this->ownStudentOrAbort($request);
        $history = $request->boolean('history');
        $schoolYear = $history ? null : $this->activeYearOrAbort();
        $documents = $student->documents()->with('schoolYear')
            ->when($schoolYear, fn ($query) => $query->where('school_year_id', $schoolYear->id))
            ->latest()->get();
        $standings = SemesterStanding::where('student_id', $student->id)
            ->whereIn('school_year_id', $documents->pluck('school_year_id'))->get()
            ->keyBy(fn ($row) => $row->school_year_id.':'.$row->semester);
        $documents->each(function (StudentDocument $document) use ($standings) {
            $standing = $standings->get($document->school_year_id.':'.$document->semester);
            $accepted = $standing?->isAccepted($document->type) ?? false;
            $note = $standing?->noteFor($document->type);
            $document->review_status = $accepted ? 'accepted' : ($note ? 'returned' : 'pending');
            $document->review_note = $note;
        });

        return StudentDocumentResource::collection($documents);
    }

    /**
     * Issue a short-lived S3 pre-signed URL so the browser uploads the file
     * straight to the bucket — it never passes through the API. The returned key
     * is what the SPA posts back to `store`.
     */
    public function presign(Request $request): JsonResponse
    {
        $student = $this->ownStudentOrAbort($request);
        $schoolYear = $this->activeYearOrAbort();

        $validated = $request->validate([
            'semester' => ['required', Rule::in(StudentDocument::SEMESTERS)],
            'type' => ['required', Rule::in(['clearance'])],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ]);

        $this->assertClearanceWritable($student, $schoolYear, $validated['semester']);

        $key = sprintf(
            'students/%s/%s/%s/%s/%s.%s',
            $student->id,
            $schoolYear->id,
            $validated['semester'],
            $validated['type'],
            Str::uuid()->toString(),
            self::ALLOWED_TYPES[$validated['content_type']],
        );

        // Sign with the exact content type so S3 rejects a mismatched PUT.
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

    /**
     * Record an uploaded document against its semester/type slot for the active
     * school year. Re-uploading replaces the slot — the superseded object is
     * removed from the bucket so it doesn't linger unreferenced.
     */
    public function store(Request $request): StudentDocumentResource
    {
        $student = $this->ownStudentOrAbort($request);
        $schoolYear = $this->activeYearOrAbort();

        $validated = $request->validate([
            'semester' => ['required', Rule::in(StudentDocument::SEMESTERS)],
            'type' => ['required', Rule::in(['clearance'])],
            'key' => ['required', 'string'],
            'file_name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
        ]);

        // Keep each upload in its own slot so replacing or removing one
        // semester's clearance cannot delete another semester's file.
        $prefix = sprintf('students/%s/%s/%s/clearance/', $student->id, $schoolYear->id, $validated['semester']);
        abort_unless(str_starts_with($validated['key'], $prefix), 422, 'Unrecognized upload.');

        [$document, $supersededKey] = DB::transaction(function () use ($student, $schoolYear, $validated) {
            // Registrar review takes the same lock before accepting a file.
            $student = Student::whereKey($student->id)->lockForUpdate()->firstOrFail();
            [$existing, $standing] = $this->assertClearanceWritable($student, $schoolYear, $validated['semester']);
            $supersededKey = $existing?->s3_key;

            $document = $student->documents()->updateOrCreate(
                [
                    'school_year_id' => $schoolYear->id,
                    'semester' => $validated['semester'],
                    'type' => $validated['type'],
                ],
                [
                    's3_key' => $validated['key'],
                    'file_name' => $validated['file_name'],
                    'size' => $validated['size'],
                    'content_type' => $validated['content_type'],
                ],
            );

            if ($standing?->clearance_note !== null) {
                $standing->update(['clearance_note' => null]);
            }

            return [$document, $supersededKey];
        });

        if ($supersededKey !== null && $supersededKey !== $validated['key']) {
            Storage::disk('s3')->delete($supersededKey);
        }

        return new StudentDocumentResource($document);
    }

    /**
     * Remove one of the student's own documents, freeing the slot for a fresh
     * upload. The S3 object goes with it so nothing lingers unreferenced.
     *
     * Only the owner may delete, and only while the year is still open: once the
     * registrar has recorded a progression decision for that school year, these
     * files are evidence behind a decision that has already been made.
     */
    public function destroy(Request $request, StudentDocument $document): Response
    {
        $student = $this->ownStudentOrAbort($request);

        // 404 rather than 403 — a student shouldn't learn another's document exists.
        abort_unless($document->student_id === $student->id, 404);
        abort_unless($document->type === 'clearance', 403, 'Grades are managed by your teacher.');

        $schoolYear = SchoolYear::findOrFail($document->school_year_id);
        $key = DB::transaction(function () use ($student, $schoolYear, $document) {
            $student = Student::whereKey($student->id)->lockForUpdate()->firstOrFail();
            [$existing] = $this->assertClearanceWritable($student, $schoolYear, $document->semester);
            abort_unless($existing?->id === $document->id, 404);

            $key = $existing->s3_key;
            $existing->delete();

            return $key;
        });

        Storage::disk('s3')->delete($key);

        return response()->noContent();
    }

    /**
     * A short-lived pre-signed GET URL for a document — readable by the owning
     * student and by any admin evaluating them at year-end.
     */
    public function viewUrl(Request $request, StudentDocument $document): JsonResponse
    {
        $this->authorizeDocument($request, $document);

        return response()->json([
            'url' => Storage::disk('s3')->temporaryUrl($document->s3_key, now()->addMinutes(10)),
            'fileName' => $document->file_name,
            'contentType' => $document->content_type,
        ]);
    }

    /**
     * Stream a document's bytes back through the API. The pre-signed view URL is
     * cross-origin, so the browser can embed it but JS can't read it — this
     * same-origin route is what makes in-app download and print work.
     */
    public function download(Request $request, StudentDocument $document)
    {
        $this->authorizeDocument($request, $document);

        $disk = Storage::disk('s3');
        abort_unless($disk->exists($document->s3_key), 404);

        return response($disk->get($document->s3_key), 200, [
            'Content-Type' => $document->content_type ?? 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.addslashes($document->file_name).'"',
        ]);
    }

    /**
     * Readable by the owning student, or any admin evaluating them at year-end.
     */
    private function authorizeDocument(Request $request, StudentDocument $document): void
    {
        $user = $request->user();
        $isOwner = $user->student !== null && $user->student->id === $document->student_id;

        $isTeacher = $document->type === 'grades'
            && $user->role === Role::Teacher
            && app(TeacherStudentAccess::class)->handles($user, $document->student, $document->schoolYear);

        abort_unless($isOwner || $user->role === Role::Admin || $isTeacher, 404);
    }

    private function ownStudentOrAbort(Request $request): Student
    {
        $student = $request->user()->student;

        abort_if($student === null, 404, 'No student record found.');

        return $student;
    }

    private function activeYearOrAbort(): SchoolYear
    {
        $schoolYear = SchoolYear::active();

        abort_if($schoolYear === null, 422, 'No school year is currently active.');

        return $schoolYear;
    }

    /** @return array{StudentDocument|null, SemesterStanding|null} */
    private function assertClearanceWritable(Student $student, SchoolYear $schoolYear, string $semester): array
    {
        $standing = SemesterStanding::query()
            ->where('student_id', $student->id)
            ->where('school_year_id', $schoolYear->id)
            ->where('semester', $semester)
            ->first();

        abort_if(
            $standing?->isAccepted('clearance') ?? false,
            422,
            'This clearance has been accepted and can no longer be replaced or removed.',
        );

        $existing = $student->documents()
            ->where('school_year_id', $schoolYear->id)
            ->where('semester', $semester)
            ->where('type', 'clearance')
            ->first();

        if ($existing !== null) {
            abort_if(
                ProgressionDecision::query()
                    ->where('student_id', $student->id)
                    ->where('from_school_year_id', $schoolYear->id)
                    ->exists(),
                422,
                'This school year has already been evaluated, so its clearance files can no longer be replaced or removed.',
            );
        }

        return [$existing, $standing];
    }
}
