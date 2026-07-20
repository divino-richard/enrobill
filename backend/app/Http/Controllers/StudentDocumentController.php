<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\StudentDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use App\Http\Resources\StudentDocumentResource;
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
        $schoolYear = $this->activeYearOrAbort();

        return StudentDocumentResource::collection(
            $student->documents()
                ->where('school_year_id', $schoolYear->id)
                ->get(),
        );
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
            'type' => ['required', Rule::in(StudentDocument::TYPES)],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ]);

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
            'type' => ['required', Rule::in(StudentDocument::TYPES)],
            'key' => ['required', 'string'],
            'file_name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
        ]);

        // Only ever accept a key this student was actually issued, so a crafted
        // request can't attach someone else's object to their own record.
        $prefix = sprintf('students/%s/%s/', $student->id, $schoolYear->id);
        abort_unless(str_starts_with($validated['key'], $prefix), 422, 'Unrecognized upload.');

        $existing = $student->documents()
            ->where('school_year_id', $schoolYear->id)
            ->where('semester', $validated['semester'])
            ->where('type', $validated['type'])
            ->first();

        if ($existing !== null && $existing->s3_key !== $validated['key']) {
            Storage::disk('s3')->delete($existing->s3_key);
        }

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

        return new StudentDocumentResource($document);
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

        abort_unless($isOwner || $user->role === Role::Admin, 404);
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
}
