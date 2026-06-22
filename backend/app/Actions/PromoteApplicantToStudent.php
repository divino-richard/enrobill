<?php

namespace App\Actions;

use App\Enums\Role;
use App\Models\Application;
use App\Models\Student;
use App\Models\Term;
use Illuminate\Support\Str;

class PromoteApplicantToStudent
{
    public function __construct(private EnsureEnrollment $ensureEnrollment) {}

    /**
     * Promote the applicant behind an accepted application: flip their role to
     * student and create their canonical student record from the application
     * snapshot. Idempotent — a user already promoted is left untouched.
     */
    public function __invoke(Application $application): ?Student
    {
        $user = $application->user;

        if ($user === null) {
            return null;
        }

        if ($user->role === Role::Applicant) {
            $user->update(['role' => Role::Student]);
        }

        // One student record per user.
        if ($user->student()->exists()) {
            $this->ensureCurrentEnrollment($user->student);

            return $user->student;
        }

        $student = $user->student()->create([
            'application_id' => $application->id,
            // Temporary unique value; replaced once we have the auto-id.
            'student_number' => Str::uuid()->toString(),
            'status' => 'admitted',
            'first_name' => $application->given_name,
            'middle_name' => $application->middle_name,
            'last_name' => $application->surname,
            'extension' => $application->extension,
            'date_of_birth' => $application->date_of_birth,
            'gender' => $application->gender,
            'nationality' => $application->nationality,
            'civil_status' => $application->civil_status,
            'place_of_birth' => $application->place_of_birth,
            'religion' => $application->religion,
            'email' => $application->email_address ?: $user->email,
            'phone_number' => $application->phone_number,
            'address_province' => $application->address_province,
            'address_city' => $application->address_city,
            'address_barangay' => $application->address_barangay,
            'address_street' => $application->address_street,
            'track_or_strand' => $application->track_or_strand,
            'year_level' => $application->year_level,
            'school_year' => $application->school_year,
        ]);

        $student->forceFill([
            'student_number' => sprintf('%d-%05d', $student->created_at->year, $student->id),
        ])->save();

        $this->ensureCurrentEnrollment($student);

        return $student;
    }

    /**
     * Open a pending enrollment for the current term, if one is open, so the
     * admitted student's program/level/semester shows immediately.
     */
    private function ensureCurrentEnrollment(Student $student): void
    {
        $term = Term::active();

        if ($term !== null) {
            ($this->ensureEnrollment)($student, $term);
        }
    }
}
