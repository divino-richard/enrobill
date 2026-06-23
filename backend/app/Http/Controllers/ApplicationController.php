<?php

namespace App\Http\Controllers;

use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use App\Models\SchoolYear;
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
     * Document types an applicant must always upload — never substitutable with
     * a promissory note. Mirrors REQUIRED_DOCUMENT_TYPES on the SPA.
     */
    private const REQUIRED_DOCUMENT_TYPES = ['good_moral', 'report_card_tor', 'diploma'];

    /**
     * Supporting document types. Any the applicant doesn't upload must be
     * covered by a promissory note. Mirrors OPTIONAL_DOCUMENT_TYPES on the SPA.
     */
    private const OPTIONAL_DOCUMENT_TYPES = ['psa_birth_certificate', 'certificate_of_enrollment'];

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

        // Applications can only be submitted while admissions are open.
        $schoolYear = $this->openSchoolYearOrFail();

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

        $application = DB::transaction(function () use ($user, $request, $schoolYear) {
            $application = $user->applications()->create([
                // Temporary unique value; replaced with the readable reference
                // once the auto-incremented id exists.
                'reference' => Str::uuid()->toString(),
                'status' => 'submitted',
                'submitted_at' => now(),
                ...$this->mapAttributes($request),
                // The school year is set by the system, not the applicant.
                'school_year' => $schoolYear->school_year,
                'semester' => $schoolYear->current_semester,
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

        // Resubmitting is a fresh submission — only allowed while admissions open.
        $schoolYear = $this->openSchoolYearOrFail();

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

        DB::transaction(function () use ($application, $request, $schoolYear) {
            $application->update([
                'status' => 'submitted',
                'submitted_at' => now(),
                ...$this->mapAttributes($request),
                // The school year is set by the system, not the applicant.
                'school_year' => $schoolYear->school_year,
                'semester' => $schoolYear->current_semester,
            ]);

            // Replace the document set with whatever the applicant resubmitted.
            $application->documents()->delete();
            $application->documents()->createMany($this->mapDocuments($request));
        });

        return new ApplicationResource($application->fresh()->load('documents'));
    }

    /**
     * The school year currently accepting applications, or a validation error if
     * admissions are closed.
     */
    private function openSchoolYearOrFail(): SchoolYear
    {
        $schoolYear = SchoolYear::admitting();

        if ($schoolYear === null) {
            throw ValidationException::withMessages([
                'application' => 'Admissions are currently closed. You can submit an application once admissions reopen.',
            ]);
        }

        return $schoolYear;
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
            'yearLevel' => ['required', Rule::in(SchoolYear::YEAR_LEVELS)],
            'semester' => ['required', 'string'],
            'schoolYear' => ['required', 'string'],
            'agreementAccepted' => ['accepted'],
            'documents' => ['array'],
            'documents.*.type' => ['required', 'string'],
            'documents.*.key' => ['required', 'string'],
            'documents.*.fileName' => ['required', 'string'],
            'documentPromissoryNote' => ['nullable', 'string', 'max:1000'],
            'documentPromissoryDate' => ['nullable', 'date', 'after_or_equal:today'],
        ], [
            'agreementAccepted.accepted' => 'You must agree to the declaration before submitting.',
        ]);

        $uploadedTypes = collect($request->input('documents', []))->pluck('type')->all();

        // Every required document must be uploaded — no promissory note can
        // substitute for these.
        if (array_diff(self::REQUIRED_DOCUMENT_TYPES, $uploadedTypes) !== []) {
            throw ValidationException::withMessages([
                'documents' => 'Please upload all required documents to continue.',
            ]);
        }

        // Any supporting document the applicant didn't upload must be covered by
        // a promissory note with an estimated date to comply.
        if (array_diff(self::OPTIONAL_DOCUMENT_TYPES, $uploadedTypes) !== []) {
            $note = trim((string) $request->input('documentPromissoryNote', ''));
            $date = $request->input('documentPromissoryDate');

            if ($note === '' || ! $date) {
                throw ValidationException::withMessages([
                    'documentPromissoryNote' => 'Write a promissory note with an estimated date to comply for the supporting documents you didn\'t upload.',
                ]);
            }
        }
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
        // The promissory note only covers supporting documents — drop it once
        // every supporting document has been uploaded.
        $uploadedTypes = collect($request->input('documents', []))->pluck('type')->all();
        $hasAllOptional = array_diff(self::OPTIONAL_DOCUMENT_TYPES, $uploadedTypes) === [];

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
            'document_promissory_note' => $hasAllOptional ? null : ($request->input('documentPromissoryNote') ?: null),
            'document_promissory_date' => $hasAllOptional ? null : ($request->input('documentPromissoryDate') ?: null),
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
