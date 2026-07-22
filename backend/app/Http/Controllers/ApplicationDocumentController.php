<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use App\Models\ApplicationDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ApplicationDocumentController extends Controller
{
    /**
     * Verification document types an applicant may upload. Mirrors the options
     * shown in the React application form.
     */
    private const DOCUMENT_TYPES = [
        'good_moral',
        'psa_birth_certificate',
        'certificate_of_enrollment',
        'report_card_tor',
        'diploma',
    ];

    /**
     * Accepted MIME types mapped to their canonical file extension.
     */
    private const ALLOWED_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'application/pdf' => 'pdf',
    ];

    /**
     * Supporting documents — the ones a promissory note can defer, and so the
     * only ones an applicant may still submit after the application is in.
     */
    private const SUPPORTING_TYPES = ['psa_birth_certificate', 'certificate_of_enrollment'];

    private const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    /**
     * Issue a short-lived S3 pre-signed URL the browser uses to upload a single
     * verification document straight to the bucket — the file never passes
     * through the API. The returned object key is what the SPA stores on the
     * application form and submits with the rest of the answers.
     */
    public function presign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', Rule::in(self::DOCUMENT_TYPES)],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
        ]);

        $extension = self::ALLOWED_TYPES[$validated['content_type']];
        $key = sprintf(
            'applications/%s/%s/%s.%s',
            $request->user()->id,
            $validated['type'],
            Str::uuid()->toString(),
            $extension,
        );

        // Sign the upload with the exact content type so S3 rejects a mismatched
        // PUT. The browser must send back the same Content-Type header.
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
     * Attach a supporting document the applicant promised but didn't upload with
     * their application. Clearing the last outstanding one also retires the
     * promissory note, since there's nothing left to promise.
     */
    public function store(Request $request, Application $application): ApplicationResource
    {
        $user = $request->user();
        abort_unless($application->user_id === $user->id, 404);

        $validated = $request->validate([
            'type' => ['required', Rule::in(self::SUPPORTING_TYPES)],
            'key' => ['required', 'string'],
            'file_name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.self::MAX_BYTES],
            'content_type' => ['required', 'string', Rule::in(array_keys(self::ALLOWED_TYPES))],
        ]);

        abort_if(
            $application->documents()->where('type', $validated['type'])->exists(),
            422,
            'That document has already been submitted.',
        );

        // Only accept a key this user was issued, so a crafted request can't
        // attach someone else's object.
        abort_unless(
            str_starts_with($validated['key'], "applications/{$user->id}/"),
            422,
            'Unrecognized upload.',
        );

        $application->documents()->create([
            'type' => $validated['type'],
            's3_key' => $validated['key'],
            'file_name' => $validated['file_name'],
            'size' => $validated['size'],
            'content_type' => $validated['content_type'],
        ]);

        $application->load('documents');
        $outstanding = array_diff(
            self::SUPPORTING_TYPES,
            $application->documents->pluck('type')->all(),
        );

        if ($outstanding === [] && $application->document_promissory_note) {
            $application->update([
                'document_promissory_note' => null,
                'document_promissory_date' => null,
            ]);
        }

        return new ApplicationResource($application->load(['user', 'documents']));
    }

    /**
     * Issue a short-lived, pre-signed GET URL so the owner can view a previously
     * uploaded document (e.g. inside a modal preview).
     */
    public function viewUrl(Request $request, Application $application, ApplicationDocument $document): JsonResponse
    {
        $user = $request->user();
        // The owning applicant, or any admin reviewing the application.
        abort_unless(
            $application->user_id === $user->id || $user->role === Role::Admin,
            404,
        );
        abort_unless($document->application_id === $application->id, 404);

        $url = Storage::disk('s3')->temporaryUrl(
            $document->s3_key,
            now()->addMinutes(10),
        );

        return response()->json([
            'url' => $url,
            'fileName' => $document->file_name,
            'contentType' => $document->content_type,
        ]);
    }

    /**
     * Stream a document's bytes back through the API. Unlike the pre-signed view
     * URL (which the browser can only embed, not read), this same-origin route
     * lets the SPA fetch the raw file for client-side download and print without
     * the S3 bucket needing browser CORS for GET reads.
     */
    public function download(Request $request, Application $application, ApplicationDocument $document)
    {
        $user = $request->user();
        // The owning applicant, or any admin reviewing the application.
        abort_unless(
            $application->user_id === $user->id || $user->role === Role::Admin,
            404,
        );
        abort_unless($document->application_id === $application->id, 404);

        $disk = Storage::disk('s3');
        abort_unless($disk->exists($document->s3_key), 404);

        return response($disk->get($document->s3_key), 200, [
            'Content-Type' => $document->content_type ?? 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.addslashes($document->file_name).'"',
        ]);
    }
}
