<?php

namespace App\Http\Resources;

use App\Models\Application;
use App\Models\Program;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Application
 */
class ApplicationResource extends JsonResource
{
    /**
     * Program names keyed by code, memoized for the request to avoid N+1 lookups
     * across a collection of applications.
     *
     * @var array<string, string>|null
     */
    private static ?array $programNames = null;

    private const SEMESTER_LABELS = [
        'first' => '1st Semester',
        'second' => '2nd Semester',
    ];

    /**
     * Resolve a program code to its display name, falling back to the raw code.
     */
    private static function programLabel(?string $code): string
    {
        if ($code === null || $code === '') {
            return '—';
        }

        self::$programNames ??= Program::pluck('name', 'code')->all();

        return self::$programNames[$code] ?? $code;
    }

    /**
     * Shape an application for API output. Summary fields drive the list view;
     * `values` carries the full form payload (camelCase, matching the React
     * `ApplicationFormValues`) for the detail and edit screens.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'program' => self::programLabel($this->track_or_strand),
            'schoolYear' => $this->school_year ?? '—',
            'semester' => self::SEMESTER_LABELS[$this->semester] ?? ($this->semester ?? '—'),
            'status' => $this->status,
            'decisionNote' => $this->decision_note,
            'submittedAt' => $this->submitted_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            // Present for admin listings (when the applicant is eager-loaded).
            'applicant' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ]),
            'values' => $this->formValues(),
        ];
    }

    /**
     * The full submitted answers, in the exact shape the React form uses, so the
     * SPA can both display the application and rehydrate the form for editing.
     *
     * @return array<string, mixed>
     */
    private function formValues(): array
    {
        return [
            'enrollmentType' => $this->enrollment_type ?? '',
            'surname' => $this->surname ?? '',
            'givenName' => $this->given_name ?? '',
            'middleName' => $this->middle_name ?? '',
            'extension' => $this->extension ?? '',
            'dateOfBirth' => $this->date_of_birth?->format('Y-m-d') ?? '',
            'age' => $this->age !== null ? (string) $this->age : '',
            'gender' => $this->gender ?? '',
            'nationality' => $this->nationality ?? '',
            'civilStatus' => $this->civil_status ?? '',
            'placeOfBirth' => $this->place_of_birth ?? '',
            'religion' => $this->religion ?? '',
            'healthConcerns' => $this->health_concerns ?? '',
            'addressStreet' => $this->address_street ?? '',
            'addressBarangay' => $this->address_barangay ?? '',
            'addressCity' => $this->address_city ?? '',
            'addressProvince' => $this->address_province ?? '',
            'homeAddress' => $this->home_address ?? '',
            'mailingAddress' => $this->mailing_address ?? '',
            'phoneNumber' => $this->phone_number ?? '',
            'emailAddress' => $this->email_address ?? '',
            'facebookAccount' => $this->facebook_account ?? '',
            'guardianName' => $this->guardian_name ?? '',
            'guardianRelation' => $this->guardian_relation ?? '',
            'guardianContactNumber' => $this->guardian_contact_number ?? '',
            'guardianAddress' => $this->guardian_address ?? '',
            'guardianOccupation' => $this->guardian_occupation ?? '',
            'prevSchoolName' => $this->prev_school_name ?? '',
            'prevSchoolGradeLevel' => $this->prev_school_grade_level ?? '',
            'prevSchoolAddress' => $this->prev_school_address ?? '',
            'prevSchoolYearGraduated' => $this->prev_school_year_graduated ?? '',
            'prevSchoolGpa' => $this->prev_school_gpa ?? '',
            'prevSchoolType' => $this->prev_school_type ?? '',
            'documents' => $this->relationLoaded('documents')
                ? $this->documents->map(fn ($document) => [
                    'id' => $document->id,
                    'type' => $document->type,
                    'key' => $document->s3_key,
                    'fileName' => $document->file_name,
                    'size' => $document->size,
                    'contentType' => $document->content_type,
                ])->all()
                : [],
            'trackOrStrand' => $this->track_or_strand ?? '',
            'yearLevel' => $this->year_level ?? '',
            'semester' => $this->semester ?? '',
            'schoolYear' => $this->school_year ?? '',
            'declarationStudentName' => $this->declaration_student_name ?? '',
            'declarationGuardianName' => $this->declaration_guardian_name ?? '',
            'dateSigned' => $this->date_signed?->toIso8601String() ?? '',
            'agreementAccepted' => (bool) $this->agreement_accepted,
        ];
    }
}
