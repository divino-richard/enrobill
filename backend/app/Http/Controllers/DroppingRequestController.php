<?php

namespace App\Http\Controllers;

use App\Actions\NotifyStudent;
use App\Enums\Role;
use App\Http\Resources\DroppingRequestResource;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Services\DroppingFinance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DroppingRequestController extends Controller
{
    public function index(Request $request)
    {
        $query = DroppingRequest::with('enrollment.bill.adjustments')->latest();
        if ($request->user()->role === Role::Student) {
            $query->where('student_id', $request->user()->student?->id ?? 0);
        } else {
            $query->where('status', '!=', 'draft');
        }

        return DroppingRequestResource::collection($query->get());
    }

    public function show(Request $request, DroppingRequest $dropping)
    {
        $this->authorizeRead($request, $dropping);

        return new DroppingRequestResource($dropping);
    }

    public function form()
    {
        return response()->download(resource_path('forms/official-dropping-form.pdf'), 'official-dropping-form.pdf');
    }

    public function assessment(Request $request, DroppingRequest $dropping)
    {
        $this->authorizeRead($request, $dropping);
        $input = $request->validate(['effectiveDate' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Manila')->toDateString()]]);

        return response()->json(['data' => app(DroppingFinance::class)->preview($dropping, $input['effectiveDate'])]);
    }

    public function store(Request $request)
    {
        $input = $request->validate(['enrollmentId' => ['required', 'integer']]);
        $submission = $this->validateSubmission($request);
        $stored = [];

        try {
            // File uploads are not retryable transaction side effects. A failed attempt
            // rolls back the request and removes its uploads before the student retries.
            return DB::transaction(function () use ($request, $input, $submission, &$stored) {
                Student::lockForUpdate()->findOrFail($request->user()->student?->id ?? 0);
                $enrollment = Enrollment::where('student_id', $request->user()->student?->id ?? 0)->lockForUpdate()->findOrFail($input['enrollmentId']);
                abort_unless($enrollment->status === 'enrolled' && $enrollment->schoolYear->is_active, 422, 'An active, enrolled school year is required.');
                $existing = DroppingRequest::where('active_enrollment_id', $enrollment->id)->first();
                if ($existing) {
                    return new DroppingRequestResource($existing);
                }
                $student = $enrollment->student;
                $dropping = DroppingRequest::create([
                    'student_id' => $student->id, 'enrollment_id' => $enrollment->id, 'active_enrollment_id' => $enrollment->id,
                    'status' => 'submitted', 'submissions' => [], 'events' => [],
                    'snapshot' => ['studentName' => trim($student->first_name.' '.$student->last_name), 'studentNumber' => $student->student_number,
                        'schoolYear' => $enrollment->schoolYear->school_year, 'program' => $enrollment->track, 'yearLevel' => $enrollment->year_level],
                ]);
                $this->storeSubmission($request, $dropping, $submission['reason'], $stored);

                return new DroppingRequestResource($dropping);
            });
        } catch (\Throwable $error) {
            $this->deleteUploads($stored);
            throw $error;
        }
    }

    public function submit(Request $request, DroppingRequest $dropping)
    {
        $this->authorizeOwner($request, $dropping);
        $input = $this->validateSubmission($request);
        $stored = [];
        try {
            return $this->locked($dropping, function ($dropping, $enrollment) use ($request, $input, &$stored) {
                abort_unless(in_array($dropping->status, ['draft', 'needs_correction'], true), 422, 'This request is not open for uploads.');
                abort_unless($enrollment->status === 'enrolled', 422, 'The enrollment has changed. Contact Records before continuing.');
                $this->storeSubmission($request, $dropping, $input['reason'], $stored);
            }, attempts: 1);
        } catch (\Throwable $error) {
            $this->deleteUploads($stored);
            throw $error;
        }
    }

    private function validateSubmission(Request $request): array
    {
        $input = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
            'files' => ['required', 'array', 'min:1', 'max:12'],
            'files.*' => ['required', 'file', 'mimetypes:application/pdf,image/jpeg,image/png', 'max:2048'],
        ]);
        abort_if(collect($request->file('files'))->sum(fn ($file) => $file->getSize()) > 7 * 1024 * 1024, 422, 'The documents must be 7 MB or less in total.');

        return $input;
    }

    private function storeSubmission(Request $request, DroppingRequest $dropping, string $reason, array &$stored): void
    {
        $version = count($dropping->submissions) + 1;
        foreach ($request->file('files') as $file) {
            $disk = 's3';
            $path = $file->store("dropping/{$dropping->id}/{$version}", ['disk' => $disk, 'visibility' => 'private']);
            abort_unless($path, 503, 'The document could not be stored. Please try again.');
            $stored[] = ['id' => (string) Str::uuid(), 'path' => $path, 'disk' => $disk,
                'name' => basename($file->getClientOriginalName()), 'mime' => $file->getMimeType(), 'size' => $file->getSize()];
        }
        $dropping->fill(['reason' => $reason, 'status' => 'submitted',
            'submissions' => [...$dropping->submissions, ['version' => $version, 'submittedAt' => now()->toIso8601String(), 'reason' => $reason, 'files' => $stored]]]);
        $dropping->record('submitted', $request->user(), 'Documents submitted.');
        $this->notify($dropping, 'Your documents were submitted. Your request is waiting for approval.');
    }

    private function deleteUploads(array $stored): void
    {
        foreach ($stored as $file) {
            Storage::disk($file['disk'])->delete($file['path']);
        }
    }

    public function cancel(Request $request, DroppingRequest $dropping)
    {
        $this->authorizeOwner($request, $dropping);

        return $this->locked($dropping, function ($dropping) use ($request) {
            if ($dropping->status === 'cancelled') {
                return;
            }
            abort_unless(in_array($dropping->status, DroppingRequest::OPEN, true), 422, 'This request can no longer be cancelled.');
            $dropping->fill(['status' => 'cancelled', 'active_enrollment_id' => null]);
            $dropping->record('cancelled', $request->user());
        });
    }

    public function decision(Request $request, DroppingRequest $dropping)
    {
        $input = $request->validate(['outcome' => ['required', Rule::in(['needs_correction', 'rejected'])], 'remarks' => ['required', 'string', 'max:2000']]);

        return $this->locked($dropping, function ($dropping) use ($request, $input) {
            $this->reviewable($dropping, $request);
            $dropping->fill(['status' => $input['outcome']]);
            if ($input['outcome'] === 'rejected') {
                $dropping->active_enrollment_id = null;
            }
            $dropping->record($input['outcome'], $request->user(), $input['remarks']);
            $this->notify($dropping, $input['remarks']);
        });
    }

    public function confirm(Request $request, DroppingRequest $dropping)
    {
        $input = $request->validate(['effectiveDate' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.now('Asia/Manila')->toDateString()], 'remarks' => ['nullable', 'string', 'max:2000']]);

        return $this->locked($dropping, function ($dropping, $enrollment) use ($request, $input) {
            if ($dropping->status === 'confirmed') {
                return;
            }
            $this->reviewable($dropping, $request);
            abort_unless($enrollment->status === 'enrolled', 422, 'The enrollment is no longer enrolled.');
            $firstDate = $enrollment->enrolled_at?->timezone('Asia/Manila')->toDateString() ?? $enrollment->schoolYear->start_date?->toDateString();
            abort_if($firstDate && $input['effectiveDate'] < $firstDate, 422, 'The effective date cannot precede enrollment.');
            $request->validate(['assessmentFingerprint' => ['required', 'string', 'max:128']]);
            SchoolYear::lockForUpdate()->findOrFail($enrollment->school_year_id);
            $finance = app(DroppingFinance::class);
            $preview = $finance->preview($dropping, $input['effectiveDate']);
            abort_unless($preview['ready'], 422, implode(' ', $preview['issues']));
            abort_unless(hash_equals($preview['fingerprint'], $request->string('assessmentFingerprint')->toString()), 409,
                'The charge has changed. Review the updated calculation before approving.');
            $finance->finalize($dropping, $input['effectiveDate'], $request->user()->id);
            $enrollment->update(['status' => 'dropped']);
            $enrollment->student->syncStatusFromLatestEnrollment();
            $dropping->fill(['status' => 'confirmed', 'active_enrollment_id' => null, 'confirmed_by' => $request->user()->id,
                'confirmed_at' => now(), 'effective_date' => $input['effectiveDate'], 'final_remarks' => ($input['remarks'] ?? null)]);
            $dropping->record('confirmed', $request->user(), ($input['remarks'] ?? null));
            $this->notify($dropping, 'Your dropping request is approved effective '.$input['effectiveDate'].'. Any remaining dropping balance is payable upon re-enrollment. No immediate payment or clearance is required.');
        });
    }

    public function file(Request $request, DroppingRequest $dropping, string $fileId)
    {
        $this->authorizeRead($request, $dropping);
        $file = collect($dropping->submissions)->flatMap(fn ($submission) => $submission['files'])->firstWhere('id', $fileId);
        abort_unless($file, 404);

        return Storage::disk($file['disk'])->response($file['path'], $file['name'], ['Content-Type' => $file['mime'], 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function acknowledgment(Request $request, DroppingRequest $dropping)
    {
        $this->authorizeRead($request, $dropping);
        abort_unless($dropping->status === 'confirmed', 422, 'You can download the approval after this request is approved.');

        return response()->view('dropping.acknowledgment', ['dropping' => $dropping], 200, [
            'Content-Disposition' => 'attachment; filename="'.$dropping->reference().'-acknowledgment.html"',
            'Cache-Control' => 'private, no-store', 'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'",
        ]);
    }

    private function locked(DroppingRequest $dropping, callable $action, int $attempts = 3): DroppingRequestResource
    {
        return DB::transaction(function () use ($dropping, $action) {
            // Shared with payment, credit, and returning-enrollment transactions.
            Student::lockForUpdate()->findOrFail($dropping->student_id);
            $enrollment = Enrollment::lockForUpdate()->findOrFail($dropping->enrollment_id);
            $enrollment->bill()->lockForUpdate()->first();
            $fresh = DroppingRequest::lockForUpdate()->findOrFail($dropping->id);
            $action($fresh, $enrollment);

            return new DroppingRequestResource($fresh->refresh());
        }, $attempts);
    }

    private function reviewable(DroppingRequest $dropping, Request $request): void
    {
        abort_unless($dropping->status === 'submitted', 422, 'This request is not awaiting review.');
        $request->validate(['version' => ['required', 'integer', 'min:1']]);
        abort_unless($request->integer('version') === count($dropping->submissions), 409, 'The student uploaded new documents. Refresh this page before making a decision.');
    }

    private function authorizeOwner(Request $request, DroppingRequest $dropping): void
    {
        abort_unless($request->user()->role === Role::Student && $request->user()->student?->id === $dropping->student_id, 404);
    }

    private function authorizeRead(Request $request, DroppingRequest $dropping): void
    {
        if ($request->user()->role === Role::Admin) {
            return;
        }
        $this->authorizeOwner($request, $dropping);
    }

    private function notify(DroppingRequest $dropping, string $message): void
    {
        app(NotifyStudent::class)($dropping->student_id, 'enrollment', 'Dropping request '.$dropping->reference(), $message,
            ctaLabel: 'View dropping request', ctaUrl: '/portal/dropping-requests/'.$dropping->id, actionRequired: $dropping->status === 'needs_correction');
    }
}
