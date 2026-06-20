<?php

namespace App\Http\Controllers;

use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use App\Models\FeeStructure;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ApplicationController extends Controller
{
    /**
     * Statuses that count as an in-progress application — only one is allowed
     * per applicant at a time.
     */
    private const ACTIVE_STATUSES = ['draft', 'submitted', 'under_review', 'returned'];

    /**
     * The authenticated applicant's applications, newest first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $applications = $request->user()->applications()->latest()->get();

        return ApplicationResource::collection($applications);
    }

    /**
     * Submit a new application for the authenticated applicant.
     */
    public function store(Request $request): ApplicationResource
    {
        $this->validateApplication($request);

        $user = $request->user();

        // An accepted application means the user is already enrolled — no more
        // applications.
        if ($user->applications()->where('status', 'accepted')->exists()) {
            throw ValidationException::withMessages([
                'application' => 'You already have an accepted application and cannot submit another.',
            ]);
        }

        // Enforce one in-progress application at a time.
        if ($user->applications()->whereIn('status', self::ACTIVE_STATUSES)->exists()) {
            throw ValidationException::withMessages([
                'application' => 'You already have an application in progress.',
            ]);
        }

        $application = DB::transaction(function () use ($user, $request) {
            $application = $user->applications()->create([
                // Temporary unique value; replaced with the readable reference
                // once the auto-incremented id exists.
                'reference' => Str::uuid()->toString(),
                'status' => 'submitted',
                'submitted_at' => now(),
                ...$this->mapAttributes($request),
            ]);

            $application->forceFill([
                'reference' => sprintf('APP-%d-%06d', $application->created_at->year, $application->id),
            ])->save();

            $application->documents()->createMany($this->mapDocuments($request));

            return $application;
        });

        return new ApplicationResource($application->load('documents'));
    }

    /**
     * A single application owned by the authenticated applicant.
     */
    public function show(Request $request, Application $application): ApplicationResource
    {
        abort_unless($application->user_id === $request->user()->id, 404);

        return new ApplicationResource($application->load('documents'));
    }

    /**
     * Edit and resubmit a rejected application. Updates the answers, replaces
     * the documents, and moves the application back to "submitted".
     */
    public function update(Request $request, Application $application): ApplicationResource
    {
        abort_unless($application->user_id === $request->user()->id, 404);
        abort_unless(
            $application->status === 'rejected',
            403,
            'Only a rejected application can be edited and resubmitted.',
        );

        // An accepted application elsewhere means the user is already enrolled —
        // resubmitting a rejected one would let them back into the pipeline.
        if ($request->user()->applications()->where('status', 'accepted')->exists()) {
            throw ValidationException::withMessages([
                'application' => 'You already have an accepted application and cannot resubmit.',
            ]);
        }

        // Resubmitting makes this application active again — block it if another
        // application is already in progress, to keep at most one active.
        $hasOtherActive = $request->user()->applications()
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->whereKeyNot($application->id)
            ->exists();

        if ($hasOtherActive) {
            throw ValidationException::withMessages([
                'application' => 'You already have an application in progress. Please resolve it before resubmitting this one.',
            ]);
        }

        $this->validateApplication($request);

        DB::transaction(function () use ($application, $request) {
            $application->update([
                'status' => 'submitted',
                'submitted_at' => now(),
                ...$this->mapAttributes($request),
            ]);

            // Replace the document set with whatever the applicant resubmitted.
            $application->documents()->delete();
            $application->documents()->createMany($this->mapDocuments($request));
        });

        return new ApplicationResource($application->fresh()->load('documents'));
    }

    /**
     * Shared validation for submitting / resubmitting an application.
     */
    private function validateApplication(Request $request): void
    {
        $request->validate([
            'enrollmentType' => ['required', 'in:senior_high,college'],
            'surname' => ['required', 'string', 'max:100'],
            'givenName' => ['required', 'string', 'max:100'],
            'dateOfBirth' => ['required', 'date'],
            'gender' => ['required', 'string'],
            'trackOrStrand' => ['required', 'string', 'exists:programs,code'],
            'yearLevel' => ['required', Rule::in(FeeStructure::YEAR_LEVELS)],
            'semester' => ['required', 'string'],
            'schoolYear' => ['required', 'string'],
            'agreementAccepted' => ['accepted'],
            'documents' => ['array', 'min:3'],
            'documents.*.type' => ['required', 'string'],
            'documents.*.key' => ['required', 'string'],
            'documents.*.fileName' => ['required', 'string'],
        ], [
            'agreementAccepted.accepted' => 'You must agree to the declaration before submitting.',
            'documents.min' => 'Please upload at least 3 verification documents.',
        ]);
    }

    /**
     * Normalize the incoming documents into rows for `application_documents`.
     *
     * @return array<int, array<string, mixed>>
     */
    private function mapDocuments(Request $request): array
    {
        return collect($request->input('documents', []))
            ->map(fn (array $doc) => [
                'type' => $doc['type'],
                's3_key' => $doc['key'],
                'file_name' => $doc['fileName'],
                'size' => $doc['size'] ?? null,
                'content_type' => $doc['contentType'] ?? null,
            ])
            ->all();
    }

    /**
     * Map the camelCase form payload to the applications table columns.
     *
     * @return array<string, mixed>
     */
    private function mapAttributes(Request $request): array
    {
        return [
            'enrollment_type' => $request->input('enrollmentType'),
            'surname' => $request->input('surname'),
            'given_name' => $request->input('givenName'),
            'middle_name' => $request->input('middleName'),
            'extension' => $request->input('extension'),
            'date_of_birth' => $request->input('dateOfBirth') ?: null,
            'age' => $request->filled('age') ? (int) $request->input('age') : null,
            'gender' => $request->input('gender'),
            'nationality' => $request->input('nationality'),
            'civil_status' => $request->input('civilStatus'),
            'place_of_birth' => $request->input('placeOfBirth'),
            'religion' => $request->input('religion'),
            'health_concerns' => $request->input('healthConcerns'),
            'address_street' => $request->input('addressStreet'),
            'address_barangay' => $request->input('addressBarangay'),
            'address_city' => $request->input('addressCity'),
            'address_province' => $request->input('addressProvince'),
            'home_address' => $request->input('homeAddress'),
            'mailing_address' => $request->input('mailingAddress'),
            'phone_number' => $request->input('phoneNumber'),
            'email_address' => $request->input('emailAddress'),
            'facebook_account' => $request->input('facebookAccount'),
            'guardian_name' => $request->input('guardianName'),
            'guardian_relation' => $request->input('guardianRelation'),
            'guardian_contact_number' => $request->input('guardianContactNumber'),
            'guardian_address' => $request->input('guardianAddress'),
            'guardian_occupation' => $request->input('guardianOccupation'),
            'prev_school_name' => $request->input('prevSchoolName'),
            'prev_school_grade_level' => $request->input('prevSchoolGradeLevel'),
            'prev_school_address' => $request->input('prevSchoolAddress'),
            'prev_school_year_graduated' => $request->input('prevSchoolYearGraduated'),
            'prev_school_gpa' => $request->input('prevSchoolGpa'),
            'prev_school_type' => $request->input('prevSchoolType'),
            'track_or_strand' => $request->input('trackOrStrand'),
            'year_level' => $request->input('yearLevel'),
            'semester' => $request->input('semester'),
            'school_year' => $request->input('schoolYear'),
            'declaration_student_name' => $request->input('declarationStudentName'),
            'declaration_guardian_name' => $request->input('declarationGuardianName'),
            'date_signed' => $request->input('dateSigned') ?: null,
            'agreement_accepted' => $request->boolean('agreementAccepted'),
        ];
    }
}
