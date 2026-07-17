<?php

namespace App\Actions;

use App\Enums\Role;
use App\Models\Application;
use App\Models\SchoolYear;
use App\Models\Student;
use Illuminate\Support\Str;

class PromoteApplicantToStudent
{
    public function __construct(private EnsureEnrollment $ensureEnrollment) {}

    /**
     * Promote the applicant behind an accepted application: flip their role to
     * student and create their canonical student record from the application
     * snapshot. Opens a pending enrollment for the active school year, carrying the
     * voucher the admin granted on acceptance — the bill is generated separately by
     * the cashier, which is where that voucher gets applied and where the
     * downpayment waiver is derived. Idempotent — a user already promoted is left
     * untouched.
     *
     * @param  int|null  $discountId  the voucher the admin granted, if any
     */
    public function __invoke(Application $application, ?int $discountId = null): ?Student
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
            $this->ensureCurrentEnrollment($user->student, $discountId);

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

        $this->ensureCurrentEnrollment($student, $discountId);

        return $student;
    }

    /**
     * Open the student's pending enrollment for the active school year, tagged with
     * the granted voucher. No bill is created here — the cashier generates it
     * later, and that is when the voucher is applied and waives the downpayment.
     */
    private function ensureCurrentEnrollment(Student $student, ?int $discountId): void
    {
        $schoolYear = SchoolYear::active();

        if ($schoolYear !== null) {
            ($this->ensureEnrollment)($student, $schoolYear, discountId: $discountId);
        }
    }
}
