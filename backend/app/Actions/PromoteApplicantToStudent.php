<?php

namespace App\Actions;

use App\Enums\Role;
use App\Models\Application;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Support\Str;

class PromoteApplicantToStudent
{
    public function __construct(private GenerateBillForStudent $generateBill) {}

    /**
     * Promote the applicant behind an accepted application: flip their role to
     * student and create their canonical student record from the application
     * snapshot. Generates their bill for the active school year immediately so it
     * shows the moment they're accepted. Idempotent — a user already promoted is
     * left untouched. `$noDownpayment` waives the downpayment (private-school grad).
     */
    public function __invoke(Application $application, bool $noDownpayment = false): ?Student
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
            $this->ensureCurrentBill($user->student, $noDownpayment);

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

        $this->ensureCurrentBill($student, $noDownpayment);

        return $student;
    }

    /**
     * Open the student's enrollment for the active school year and generate their
     * bill (when fees are defined) so their program and balance show immediately.
     */
    private function ensureCurrentBill(Student $student, bool $noDownpayment): void
    {
        $schoolYear = SchoolYear::active();

        if ($schoolYear !== null) {
            ($this->generateBill)($student, $schoolYear, noDownpayment: $noDownpayment);
        }
    }
}
