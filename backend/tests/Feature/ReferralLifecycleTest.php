<?php

namespace Tests\Feature;

use App\Actions\ReferralLifecycle;
use App\Enums\Role;
use App\Models\Application;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\Freebie;
use App\Models\IncentiveAward;
use App\Models\Referral;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Closure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ReferralLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_code_issuance_requires_an_active_campaign_and_a_prior_year_enrolled_grade_11_student(): void
    {
        [$priorYear, $targetYear] = $this->createSchoolYears();
        $referrer = $this->createStudent();
        $priorEnrollment = $this->createEnrollment($referrer, $priorYear, 'grade_11', 'enrolled');
        $lifecycle = app(ReferralLifecycle::class);

        $this->assertValidationField(
            'referralCode',
            fn () => $lifecycle->issueCode($referrer, $targetYear),
        );

        $this->createReferralCampaign($targetYear);
        $code = $lifecycle->issueCode($referrer, $targetYear);
        $sameCode = $lifecycle->issueCode($referrer, $targetYear);

        $this->assertTrue($code->is($sameCode));
        $this->assertSame($code->code, $sameCode->code);
        $this->assertSame($priorEnrollment->id, $code->qualifying_enrollment_id);
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{20}$/', $code->code);
        $this->assertStringNotContainsString($referrer->student_number, $code->code);

        $ineligible = $this->createStudent();
        $this->createEnrollment($ineligible, $priorYear, 'grade_11', 'pending');

        $this->assertValidationField(
            'referrer',
            fn () => $lifecycle->issueCode($ineligible, $targetYear),
        );
    }

    public function test_code_validation_enforces_school_year_scope_self_referral_and_new_or_transferee_grade_11_only(): void
    {
        [$priorYear, $targetYear] = $this->createSchoolYears();
        $otherTargetYear = $this->createSchoolYear('2027-2028', true, true);
        $this->createReferralCampaign($targetYear);
        $this->createReferralCampaign($otherTargetYear);

        $referrer = $this->createStudent();
        $this->createEnrollment($referrer, $priorYear, 'grade_11', 'enrolled');

        $lifecycle = app(ReferralLifecycle::class);
        $code = $lifecycle->issueCode($referrer, $targetYear);
        $validApplication = $this->createReferralApplication($targetYear, 'new');

        $validated = $lifecycle->validateCode(
            Str::lower($code->code),
            $targetYear,
            $validApplication,
            $validApplication->user,
        );

        $this->assertTrue($code->is($validated));

        $this->assertValidationField(
            'referralCode',
            fn () => $lifecycle->validateCode($code->code, $otherTargetYear, $validApplication),
        );

        $selfApplication = $this->createReferralApplication($targetYear, 'new', $referrer->user);
        $this->assertValidationField(
            'referralCode',
            fn () => $lifecycle->validateCode($code->code, $targetYear, $selfApplication),
        );

        $continuingApplication = $this->createReferralApplication($targetYear, 'continuing');
        $this->assertValidationField(
            'referralCode',
            fn () => $lifecycle->validateCode($code->code, $targetYear, $continuingApplication),
        );

        $grade12Application = $this->createReferralApplication($targetYear, 'transferee', yearLevel: 'grade_12');
        $this->assertValidationField(
            'referralCode',
            fn () => $lifecycle->validateCode($code->code, $targetYear, $grade12Application),
        );
    }

    public function test_acceptance_success_progression_and_retries_create_only_the_fixed_one_referrer_award(): void
    {
        [$priorYear, $targetYear] = $this->createSchoolYears();
        $this->createReferralCampaign($targetYear);

        $referrer = $this->createStudent();
        $this->createEnrollment($referrer, $priorYear, 'grade_11', 'enrolled');

        $lifecycle = app(ReferralLifecycle::class);
        $code = $lifecycle->issueCode($referrer, $targetYear);

        [$firstApplication, $firstStudent, $firstEnrollment] = $this->createReferredApplicant($targetYear);
        $claim = $lifecycle->syncApplication($firstApplication, $code->code, $firstApplication->user);

        $this->assertSame(Referral::STATUS_CLAIMED, $claim?->status);

        $accepted = $lifecycle->acceptApplication($firstApplication, $firstEnrollment);
        $lifecycle->acceptApplication($firstApplication, $firstEnrollment);

        $this->assertSame(Referral::STATUS_ACCEPTED, $accepted?->status);
        $this->assertDatabaseHas('incentive_awards', [
            'school_year_id' => $targetYear->id,
            'student_id' => $firstStudent->id,
            'enrollment_id' => $firstEnrollment->id,
            'type' => IncentiveAward::TYPE_REFERRAL,
            'beneficiary' => IncentiveAward::BENEFICIARY_REFERRED_GRADE_11,
            'status' => IncentiveAward::STATUS_ELIGIBLE,
        ]);

        Bill::create(['student_id' => $firstEnrollment->student_id, 'enrollment_id' => $firstEnrollment->id, 'school_year_id' => $firstEnrollment->school_year_id, 'total' => 0, 'amount_paid' => 0, 'status' => 'paid']);
        $firstEnrollment->update(['status' => 'enrolled', 'enrolled_at' => now()]);
        $successful = $lifecycle->markEnrollmentSuccessful($firstEnrollment->fresh());
        $lifecycle->markEnrollmentSuccessful($firstEnrollment->fresh());

        $this->assertSame(Referral::STATUS_SUCCESSFUL, $successful?->status);
        $this->assertDatabaseHas('incentive_awards', [
            'school_year_id' => $targetYear->id,
            'student_id' => $referrer->id,
            'enrollment_id' => null,
            'type' => IncentiveAward::TYPE_REFERRAL,
            'beneficiary' => IncentiveAward::BENEFICIARY_REFERRER_GRADE_12,
            'status' => IncentiveAward::STATUS_PENDING,
        ]);

        $grade12Enrollment = $this->createEnrollment($referrer, $targetYear, 'grade_12', 'pending');
        $award = $lifecycle->attachReferrerEnrollment($grade12Enrollment);
        $sameAward = $lifecycle->attachReferrerEnrollment($grade12Enrollment);

        $this->assertTrue($award?->is($sameAward));
        $this->assertSame($grade12Enrollment->id, $award?->enrollment_id);
        $this->assertSame(IncentiveAward::STATUS_ELIGIBLE, $award?->status);

        [$secondApplication, $secondStudent, $secondEnrollment] = $this->createReferredApplicant($targetYear);
        $lifecycle->syncApplication($secondApplication, $code->code, $secondApplication->user);
        $lifecycle->acceptApplication($secondApplication, $secondEnrollment);
        Bill::create(['student_id' => $secondEnrollment->student_id, 'enrollment_id' => $secondEnrollment->id, 'school_year_id' => $secondEnrollment->school_year_id, 'total' => 0, 'amount_paid' => 0, 'status' => 'paid']);
        $secondEnrollment->update(['status' => 'enrolled', 'enrolled_at' => now()]);
        $lifecycle->markEnrollmentSuccessful($secondEnrollment->fresh());

        $this->assertSame(1, IncentiveAward::query()
            ->where('school_year_id', $targetYear->id)
            ->where('student_id', $referrer->id)
            ->where('type', IncentiveAward::TYPE_REFERRAL)
            ->count());
        $this->assertDatabaseHas('incentive_awards', [
            'school_year_id' => $targetYear->id,
            'student_id' => $secondStudent->id,
            'enrollment_id' => $secondEnrollment->id,
            'beneficiary' => IncentiveAward::BENEFICIARY_REFERRED_GRADE_11,
        ]);
        $this->assertSame(3, IncentiveAward::query()
            ->where('school_year_id', $targetYear->id)
            ->where('type', IncentiveAward::TYPE_REFERRAL)
            ->count());
    }

    /**
     * @return array{SchoolYear, SchoolYear}
     */
    private function createSchoolYears(): array
    {
        return [
            $this->createSchoolYear('2025-2026', false, false),
            $this->createSchoolYear('2026-2027', true, true),
        ];
    }

    private function createSchoolYear(string $name, bool $active, bool $admitting): SchoolYear
    {
        $startYear = (int) substr($name, 0, 4);

        return SchoolYear::create([
            'school_year' => $name,
            'start_date' => "{$startYear}-06-01",
            'end_date' => ($startYear + 1).'-03-31',
            'is_active' => $active,
            'admission_open' => $admitting,
            'downpayment_type' => 'fixed',
            'downpayment_value' => 100,
            'installment_count' => 4,
        ]);
    }

    private function createReferralCampaign(SchoolYear $schoolYear): Freebie
    {
        return Freebie::create([
            'school_year_id' => $schoolYear->id,
            'type' => IncentiveAward::TYPE_REFERRAL,
            'name' => 'Referral Zero Tuition',
            'is_active' => true,
            'min_referrals' => 1,
        ]);
    }

    private function createStudent(?Application $application = null): Student
    {
        $user = $application?->user ?? User::factory()->create(['role' => Role::Student]);

        return Student::create([
            'user_id' => $user->id,
            'application_id' => $application?->id,
            'student_number' => 'STU-'.Str::upper(Str::random(12)),
            'status' => 'admitted',
            'first_name' => 'Test',
            'last_name' => 'Student',
        ]);
    }

    private function createEnrollment(
        Student $student,
        SchoolYear $schoolYear,
        string $yearLevel,
        string $status,
    ): Enrollment {
        return Enrollment::create([
            'student_id' => $student->id,
            'school_year_id' => $schoolYear->id,
            'track' => 'stem',
            'year_level' => $yearLevel,
            'status' => $status,
            'enrolled_at' => $status === 'enrolled' ? now() : null,
        ]);
    }

    private function createReferralApplication(
        SchoolYear $schoolYear,
        string $studentType,
        ?User $user = null,
        string $yearLevel = 'grade_11',
    ): Application {
        $user ??= User::factory()->create(['role' => Role::Applicant]);

        return Application::create([
            'user_id' => $user->id,
            'reference' => 'APP-'.Str::upper(Str::random(12)),
            'status' => 'submitted',
            'enrollment_type' => 'freshman',
            'student_type' => $studentType,
            'surname' => 'Applicant',
            'given_name' => 'Test',
            'track_or_strand' => 'stem',
            'year_level' => $yearLevel,
            'school_year' => $schoolYear->school_year,
        ]);
    }

    /**
     * @return array{Application, Student, Enrollment}
     */
    private function createReferredApplicant(SchoolYear $targetYear): array
    {
        $application = $this->createReferralApplication($targetYear, 'new');
        $student = $this->createStudent($application);
        $enrollment = $this->createEnrollment($student, $targetYear, 'grade_11', 'pending');

        return [$application, $student, $enrollment];
    }

    private function assertValidationField(string $field, Closure $callback): void
    {
        try {
            $callback();
            $this->fail("Expected a validation error for {$field}.");
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey($field, $exception->errors());
        }
    }
}
