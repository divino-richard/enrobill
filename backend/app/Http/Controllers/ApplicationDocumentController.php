<?php

namespace App\Http\Controllers;

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
}
