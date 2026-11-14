<?php

namespace App\Http\Controllers;

use App\Models\Enrollment;
use App\Models\Student;
use App\Support\DroppingUploads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DroppingUploadController extends Controller
{
    public function presign(Request $request): JsonResponse
    {
        $input = $request->validate([
            'enrollmentId' => ['required', 'integer'],
            ...DroppingUploads::metadataRules(),
        ]);
        DroppingUploads::assertTotalSize($input['files']);
        $enrollment = $this->ownEnrollment($request, $input['enrollmentId']);
        $open = $enrollment->openDroppingRequest;
        abort_unless($enrollment->status === 'enrolled', 422, 'The enrollment has changed. Contact Records before continuing.');
        if ($open) {
            abort_unless(in_array($open->status, ['draft', 'needs_correction'], true), 422, 'This request is not open for uploads.');
        } else {
            abort_unless($enrollment->schoolYear->is_active, 422, 'An active, enrolled school year is required.');
        }

        $uploads = [];
        $disk = Storage::disk('s3');
        $expires = now()->addMinutes(10);
        foreach ($input['files'] as $file) {
            $key = DroppingUploads::makeKey($enrollment->student_id, $enrollment->id, $file['mime']);
            $signed = $disk->temporaryUploadUrl($key, $expires, [
                'ContentType' => $file['mime'],
                'ContentLength' => (int) $file['size'],
            ]);
            $uploads[] = ['key' => $key, 'url' => $signed['url']];
        }

        return response()->json(['data' => $uploads]);
    }

    public function discard(Request $request): Response
    {
        $input = $request->validate([
            'enrollmentId' => ['required', 'integer'],
            'keys' => ['required', 'array', 'list', 'min:1', 'max:'.DroppingUploads::MAX_FILES],
            'keys.*' => ['required', 'string', 'max:255', 'distinct:strict'],
        ]);

        return DB::transaction(function () use ($request, $input) {
            $student = Student::lockForUpdate()->findOrFail($request->user()->student?->id ?? 0);
            $enrollment = Enrollment::where('student_id', $student->id)->lockForUpdate()->findOrFail($input['enrollmentId']);
            foreach ($input['keys'] as $key) {
                if (! DroppingUploads::ownsKey($key, $student->id, $enrollment->id)) {
                    throw ValidationException::withMessages(['keys' => 'One or more upload keys are invalid for this enrollment.']);
                }
            }
            abort_unless(Storage::disk('s3')->delete($input['keys']), 503, 'The temporary documents could not be removed. Please try again.');

            return response()->noContent();
        });
    }

    private function ownEnrollment(Request $request, int $enrollmentId): Enrollment
    {
        return Enrollment::where('student_id', $request->user()->student?->id)->findOrFail($enrollmentId);
    }
}
