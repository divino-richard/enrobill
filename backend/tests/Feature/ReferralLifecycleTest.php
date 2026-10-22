<?php

namespace Tests\Feature;

use App\Actions\ReferralLifecycle;
use App\Enums\Role;
use App\Http\Controllers\Admin\ApplicationController;
use App\Models\Application;
use App\Models\Bill;
use App\Models\BillAdjustment;
use App\Models\Discount;
use App\Models\Enrollment;
use App\Models\Freebie;
use App\Models\IncentiveAward;
use App\Models\Referral;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use App\Services\ReferralPaymentGuard;
use Carbon\Carbon;
use Closure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\HttpException;
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

    #[DataProvider('paymentsBeforeReferralSuccess')]
    public function test_referral_success_updates_a_previously_generated_referrer_bill(float $paid, float $expectedCredit): void
    {
        [$priorYear, $targetYear] = $this->createSchoolYears();
        $this->createReferralCampaign($targetYear);
        $targetYear->fees()->create([
            'name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition',
            'type' => 'default', 'year_level' => 'all',
        ]);
        $voucher = Discount::create([
            'name' => 'Grade 12 voucher', 'category' => 'voucher',
            'type' => 'fixed', 'value' => 600, 'is_active' => true,
        ]);
        $referrer = $this->createStudent();
        $this->createEnrollment($referrer, $priorYear, 'grade_11', 'enrolled');
        $grade12 = $this->createEnrollment($referrer, $targetYear, 'grade_12', 'pending');
        $grade12->update(['discount_id' => $voucher->id]);

        $lifecycle = app(ReferralLifecycle::class);
        $code = $lifecycle->issueCode($referrer, $targetYear);
        [$application, , $referredEnrollment] = $this->createReferredApplicant($targetYear);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/{$grade12->id}/bill")->assertSuccessful();
        $bill = $grade12->bill()->firstOrFail();
        $this->assertSame(400.0, $bill->balance());
        $this->assertSame(0, $bill->adjustments()->whereNotNull('incentive_key')->count());

        if ($paid > 0) {
            $bill->payments()->create(['amount' => $paid, 'method' => 'cash', 'paid_at' => now(), 'status' => 'verified']);
            $bill->recalculate();
        }

        // Legacy payments remain immutable; new payments are protected by the reservation.
        $lifecycle->syncApplication($application, $code->code, $application->user);
        $referral = $lifecycle->acceptApplication($application, $referredEnrollment);

        // The referred student enrolls later through the real cashier payment flow.
        $this->postJson("/api/admin/enrollments/{$referredEnrollment->id}/bill")->assertSuccessful();
        $referredBill = $referredEnrollment->bill()->firstOrFail();
        $this->assertSame('pending', $referredEnrollment->fresh()->status);
        $this->postJson("/api/admin/bills/{$referredBill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertSuccessful();

        $this->assertSame('enrolled', $referredEnrollment->fresh()->status);
        $this->assertSame(Referral::STATUS_SUCCESSFUL, $referral->fresh()->status);
        $award = IncentiveAward::where('student_id', $referrer->id)->sole();
        $this->assertSame($expectedCredit > 0 ? IncentiveAward::STATUS_APPLIED : IncentiveAward::STATUS_APPLIED_NO_BALANCE, $award->status);
        $this->assertSame($expectedCredit, (float) $bill->adjustments()
            ->where('incentive_key', BillAdjustment::INCENTIVE_KEY_ZERO_TUITION)->sum('amount'));
        $this->assertSame($paid, (float) $bill->fresh()->amount_paid);
        $this->assertSame(0.0, $bill->fresh()->balance());
        $this->assertSame('paid', $bill->fresh()->status);
        $this->assertSame(1, $grade12->bill()->count());
        $this->assertSame(1, $referrer->notifications()->where('title', 'like', 'Tuition incentive%')->count());

        $lifecycle->markEnrollmentSuccessful($referredEnrollment->fresh());
        $this->assertSame($expectedCredit > 0 ? 1 : 0, $bill->adjustments()->whereNotNull('incentive_key')->count());
        $this->assertSame(1, $referrer->notifications()->where('title', 'like', 'Tuition incentive%')->count());
    }

    public function test_pending_referral_allows_bill_generation_but_blocks_cashier_and_both_student_payment_routes(): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        $payload = ['amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString()];
        $url = "/api/admin/bills/{$bill->id}";
        $this->actingAs($cashier)->getJson($url)->assertSuccessful()
            ->assertJsonPath('data.referralPaymentGuard.reason', 'referral_pending');
        $this->postJson("{$url}/payments", $payload)->assertUnprocessable()->assertJsonValidationErrors('payment');
        $this->actingAs($bill->student->user);
        $payload = [...$payload, 'method' => 'gcash', 'proofKey' => 'proof.png', 'amount' => 400];
        foreach (["/api/me/bills/{$bill->id}/payments", '/api/me/bill/payments'] as $endpoint) {
            $this->postJson($endpoint, $payload)->assertUnprocessable()->assertJsonValidationErrors('payment');
        }
        $this->assertSame(0, $bill->payments()->count());
        $this->assertSame(400.0, $bill->fresh()->balance());
        $referral->update(['status' => Referral::STATUS_ACCEPTED]);
        Freebie::where('school_year_id', $bill->school_year_id)->update(['is_active' => false]);
        $this->actingAs($cashier)->postJson("{$url}/payments", $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('payment');
    }

    public function test_pending_referral_blocks_verification_but_allows_rejection_and_verified_retries(): void
    {
        [$bill, , $cashier] = $this->pendingReferrerBill();
        $payment = $bill->payments()->create(['amount' => 100, 'method' => 'gcash', 'paid_at' => now(), 'status' => 'pending']);
        $url = "/api/admin/bills/{$bill->id}/payments/{$payment->id}";
        $this->actingAs($cashier)->postJson("{$url}/verify")->assertUnprocessable()->assertJsonValidationErrors('payment');
        $this->assertSame('pending', $payment->fresh()->status);
        $this->assertSame(400.0, $bill->fresh()->balance());
        $this->postJson("{$url}/reject")->assertSuccessful();
        $this->assertSame('rejected', $payment->fresh()->status);
        // A retry of a historical verified payment does not collect twice.
        $payment->update(['status' => 'verified']);
        $bill->recalculate();
        $this->postJson("{$url}/verify")->assertSuccessful();
        $this->assertSame(1, $bill->payments()->count());
        $this->assertSame(300.0, $bill->fresh()->balance());
    }

    public function test_cancelling_a_claim_does_not_end_the_code_holders_reservation_before_cutoff(): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        app(ReferralLifecycle::class)->cancelApplication($referral->referredApplication, $cashier, 'Applicant withdrew.');
        $this->actingAs($cashier)->postJson("/api/admin/bills/{$bill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('payment');
        $this->assertSame(400.0, $bill->fresh()->balance());
    }

    public function test_cancelling_one_of_multiple_claims_keeps_the_reservation_active(): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        $lifecycle = app(ReferralLifecycle::class);
        $application = $this->createReferralApplication($bill->schoolYear, 'new');
        $lifecycle->syncApplication($application, $referral->referralCode->code, $application->user);
        $lifecycle->cancelApplication($referral->referredApplication, $cashier, 'Applicant withdrew.');
        $this->actingAs($cashier)->postJson("/api/admin/bills/{$bill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('payment');
        $this->assertSame(0, $bill->payments()->count());
    }

    public function test_success_does_not_release_the_hold_before_the_credit_is_applied(): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        // Model the committed success state before the reconciliation hook finishes.
        $referral->update(['status' => Referral::STATUS_SUCCESSFUL, 'successful_at' => now()]);
        $this->actingAs($cashier)->getJson("/api/admin/bills/{$bill->id}")->assertSuccessful()
            ->assertJsonPath('data.referralPaymentGuard.reason', 'referral_credit_pending');
        $this->postJson("/api/admin/bills/{$bill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('payment');
        $this->assertSame(0, $bill->payments()->count());
        $this->assertSame(400.0, $bill->fresh()->balance());
    }

    public function test_success_clears_the_guard_even_with_another_pending_referral(): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        $lifecycle = app(ReferralLifecycle::class);
        [$application, , $enrollment] = $this->createReferredApplicant($bill->schoolYear);
        $lifecycle->syncApplication($application, $referral->referralCode->code, $application->user);
        $lifecycle->acceptApplication($application, $enrollment);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/{$enrollment->id}/bill")->assertSuccessful();
        $referredBill = $enrollment->bill()->firstOrFail();
        $this->postJson("/api/admin/bills/{$referredBill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertSuccessful();
        $this->getJson("/api/admin/bills/{$bill->id}")->assertSuccessful()
            ->assertJsonPath('data.referralPaymentGuard', null)->assertJsonPath('data.balance', 0);
        $this->assertSame(Referral::STATUS_CLAIMED, $referral->fresh()->status);
        $this->assertSame(0, $bill->payments()->count());
        $this->assertSame(400.0, (float) $bill->adjustments()->whereNotNull('incentive_key')->sum('amount'));
    }

    #[DataProvider('unaffectedReferrerBills')]
    public function test_guard_does_not_block_bills_outside_referral_benefit_scope(string $case): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        match ($case) {
            'no voucher' => $bill->adjustments()->update(['discount_id' => null]),
            'inactive voucher' => $bill->enrollment->discount->update(['is_active' => false]),
            'other year' => [$referral->update(['school_year_id' => $this->createSchoolYear('2028-2029', false, false)->id]), $referral->referralCode->update(['school_year_id' => $referral->school_year_id])],
            'grade 11' => $bill->enrollment->update(['year_level' => 'grade_11']),
            'no participation' => [$referral->delete(), $referral->referralCode->delete()],
        };
        $this->actingAs($cashier)->postJson("/api/admin/bills/{$bill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertSuccessful()->assertJsonPath('data.referralPaymentGuard', null);
        $this->assertSame(300.0, $bill->fresh()->balance());
    }

    public static function unaffectedReferrerBills(): array
    {
        return array_map(fn ($case) => [$case], ['no voucher', 'inactive voucher', 'other year', 'grade 11', 'no participation']);
    }

    public function test_code_reserves_the_benefit_even_before_any_applicant_uses_it(): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        $referral->delete();
        $this->actingAs($cashier)->postJson("/api/admin/bills/{$bill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('payment');
    }

    public function test_cutoff_releases_collection_and_late_enrollment_cannot_earn_the_referrer_benefit(): void
    {
        [$bill, $referral, $cashier] = $this->pendingReferrerBill();
        $student = $this->createStudent($referral->referredApplication);
        $enrollment = $this->createEnrollment($student, $bill->schoolYear, 'grade_11', 'pending');
        $lifecycle = app(ReferralLifecycle::class);
        $lifecycle->acceptApplication($referral->referredApplication, $enrollment);
        $cutoff = Freebie::where('school_year_id', $bill->school_year_id)->sole()->ends_on->toDateString();
        $this->travelTo(Carbon::parse($cutoff.' 23:59:59', 'Asia/Manila'));
        $this->actingAs($cashier)->getJson("/api/admin/bills/{$bill->id}")
            ->assertOk()->assertJsonPath('data.referralPaymentGuard.reason', 'referral_pending');
        $this->travel(1)->seconds();
        $this->getJson("/api/admin/bills/{$bill->id}")->assertOk()->assertJsonPath('data.referralPaymentGuard', null);
        $this->postJson("/api/admin/bills/{$bill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertSuccessful();
        $this->postJson("/api/admin/enrollments/{$enrollment->id}/bill")->assertSuccessful();
        $referredBill = $enrollment->bill()->firstOrFail();
        $this->postJson("/api/admin/bills/{$referredBill->id}/payments", [
            'amount' => 100, 'method' => 'cash', 'paidAt' => now()->toDateString(),
        ])->assertSuccessful();
        $this->assertSame('enrolled', $enrollment->fresh()->status);
        $this->assertSame(0, IncentiveAward::where('student_id', $bill->student_id)->count());
        $this->assertSame(IncentiveAward::STATUS_ELIGIBLE, $referral->incentiveAwards()->sole()->status);
        $this->assertSame(300.0, $bill->fresh()->balance());
    }

    public function test_cutoff_is_required_and_cannot_be_changed_after_codes_are_issued(): void
    {
        [$bill, $referral] = $this->pendingReferrerBill();
        $admin = User::factory()->create(['role' => Role::Admin]);
        $url = "/api/admin/school-years/{$bill->school_year_id}/freebies";
        $payload = ['type' => 'referral', 'name' => 'Referral', 'isActive' => true];
        $this->actingAs($admin)->putJson($url, $payload)->assertUnprocessable()->assertJsonValidationErrors('endsOn');
        $this->putJson($url, [...$payload, 'endsOn' => now('Asia/Manila')->addDays(20)->toDateString()])
            ->assertUnprocessable()->assertJsonValidationErrors('endsOn');
        $cutoff = Freebie::where('school_year_id', $bill->school_year_id)->sole()->ends_on->toDateString();
        $this->putJson($url, [...$payload, 'endsOn' => $cutoff, 'isActive' => false])->assertOk();
    }

    #[DataProvider('cutoffDatesWithinSchoolYear')]
    public function test_referral_cutoffs_must_be_within_the_school_year(string $cutoff, bool $valid): void
    {
        $this->travelTo(Carbon::parse('2026-10-22 12:00:00', 'Asia/Manila'));
        $year = $this->createSchoolYear('2027-2028', true, true);
        $year->update(['start_date' => '2027-10-04', 'end_date' => '2028-08-25']);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $response = $this->actingAs($admin)->putJson("/api/admin/school-years/{$year->id}/freebies", [
            'type' => 'referral', 'name' => 'Referral', 'isActive' => true, 'endsOn' => $cutoff,
        ]);

        if ($valid) {
            $response->assertSuccessful()->assertJsonPath('data.endsOn', $cutoff);
        } else {
            $response->assertUnprocessable()->assertJsonValidationErrors('endsOn');
            $this->assertDatabaseMissing('freebies', ['school_year_id' => $year->id, 'type' => 'referral']);
        }
    }

    public static function cutoffDatesWithinSchoolYear(): array
    {
        return [
            'before enrollment' => ['2027-10-03', false],
            'enrollment starts' => ['2027-10-04', true],
            'last day' => ['2028-08-25', true],
            'after the year ends' => ['2028-08-26', false],
        ];
    }

    public function test_invalid_published_cutoff_can_be_corrected_but_not_saved_again(): void
    {
        $this->travelTo(Carbon::parse('2026-10-22 12:00:00', 'Asia/Manila'));
        [$bill] = $this->pendingReferrerBill();
        $campaign = Freebie::where('school_year_id', $bill->school_year_id)->sole();
        $campaign->update(['ends_on' => '2026-05-31']);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $url = "/api/admin/school-years/{$bill->school_year_id}/freebies";
        $payload = ['type' => 'referral', 'name' => 'Referral', 'isActive' => true];

        $this->actingAs($admin)->getJson($url)->assertOk()->assertJsonPath('data.0.cutoffLocked', false);
        $this->putJson($url, [...$payload, 'endsOn' => '2026-05-31'])
            ->assertUnprocessable()->assertJsonValidationErrors('endsOn');
        $this->putJson($url, [...$payload, 'endsOn' => '2026-11-30'])
            ->assertOk()->assertJsonPath('data.cutoffLocked', true);
        $this->putJson($url, [...$payload, 'endsOn' => '2026-12-01'])
            ->assertUnprocessable()->assertJsonValidationErrors('endsOn');
    }

    public function test_new_codes_require_a_cutoff_and_cannot_be_created_after_a_grade_12_payment(): void
    {
        [$prior, $year] = $this->createSchoolYears();
        $campaign = $this->createReferralCampaign($year);
        $student = $this->createStudent();
        $this->createEnrollment($student, $prior, 'grade_11', 'enrolled');
        $enrollment = $this->createEnrollment($student, $year, 'grade_12', 'pending');
        $bill = Bill::create(['student_id' => $student->id, 'enrollment_id' => $enrollment->id, 'school_year_id' => $year->id, 'total' => 1000, 'amount_paid' => 100, 'status' => 'partial']);
        $bill->payments()->create(['amount' => 100, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $this->assertValidationField('referrer', fn () => app(ReferralLifecycle::class)->issueCode($student, $year));
        $bill->payments()->delete();
        $campaign->update(['ends_on' => null]);
        $this->assertValidationField('referralCode', fn () => app(ReferralLifecycle::class)->issueCode($student, $year));
    }

    public function test_expired_claims_cannot_earn_at_acceptance_and_are_reported_consistently(): void
    {
        [$bill, $referral] = $this->pendingReferrerBill();
        $this->travel(15)->days();
        $student = $this->createStudent($referral->referredApplication);
        $enrollment = $this->createEnrollment($student, $bill->schoolYear, 'grade_11', 'pending');
        $this->assertNull(app(ReferralLifecycle::class)->acceptApplication($referral->referredApplication, $enrollment));
        $this->assertSame(0, $referral->incentiveAwards()->count());
        $this->actingAs($bill->student->user)->getJson('/api/me/referrals')
            ->assertOk()->assertJsonPath('data.campaignEnabled', false)
            ->assertJsonPath('data.benefitStatus', 'expired')
            ->assertJsonPath('data.referrals.0.status', 'expired');
        $this->actingAs(User::factory()->create(['role' => Role::Admin]))
            ->getJson('/api/admin/referrals?status=expired')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/referrals?status=claimed')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_an_earned_award_survives_cutoff_and_waits_for_the_referrers_later_bill(): void
    {
        [$prior, $year] = $this->createSchoolYears();
        $this->createReferralCampaign($year);
        $referrer = $this->createStudent();
        $this->createEnrollment($referrer, $prior, 'grade_11', 'enrolled');
        $lifecycle = app(ReferralLifecycle::class);
        $code = $lifecycle->issueCode($referrer, $year);
        [$application, , $enrollment] = $this->createReferredApplicant($year);
        $lifecycle->syncApplication($application, $code->code);
        $lifecycle->acceptApplication($application, $enrollment);
        Bill::create(['student_id' => $enrollment->student_id, 'school_year_id' => $year->id, 'enrollment_id' => $enrollment->id, 'total' => 0, 'amount_paid' => 0, 'status' => 'paid']);
        $enrollment->markEnrolled();
        $this->assertSame('pending', IncentiveAward::where('student_id', $referrer->id)->sole()->status);
        $this->travel(15)->days();
        $grade12 = $this->createEnrollment($referrer, $year, 'grade_12', 'pending');
        $lifecycle->attachReferrerEnrollment($grade12);
        $voucher = Discount::create(['name' => 'Voucher', 'category' => 'voucher', 'type' => 'fixed', 'value' => 600, 'is_active' => true]);
        $grade12->update(['discount_id' => $voucher->id]);
        $year->fees()->create(['name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/{$grade12->id}/bill")
            ->assertSuccessful()->assertJsonPath('data.balance', 0);
        $this->assertSame('applied', IncentiveAward::where('student_id', $referrer->id)->sole()->status);
    }

    public function test_installment_reminders_do_not_request_payment_during_a_referral_reservation(): void
    {
        [$bill] = $this->pendingReferrerBill();
        $bill->installments()->update(['due_date' => now('Asia/Manila')->addDay()->toDateString()]);
        $this->artisan('notifications:installments-due')->assertSuccessful();
        $this->assertSame(0, $bill->student->notifications()->where('title', 'Installment due soon')->count());
    }

    public function test_school_can_set_a_first_cutoff_for_legacy_reservations_in_an_ended_year(): void
    {
        [$bill] = $this->pendingReferrerBill();
        Freebie::where('school_year_id', $bill->school_year_id)->update(['ends_on' => null]);
        $bill->schoolYear->update(['end_date' => now()->subDays(5)->toDateString()]);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $cutoff = now('Asia/Manila')->subDays(6)->toDateString();
        $this->actingAs($admin)->putJson("/api/admin/school-years/{$bill->school_year_id}/freebies", [
            'type' => 'referral', 'name' => 'Referral', 'isActive' => false, 'endsOn' => $cutoff,
        ])->assertOk()->assertJsonPath('data.cutoffLocked', true);
        $this->assertNull(app(ReferralPaymentGuard::class)->forBill($bill->fresh()));
    }

    public function test_existing_codes_cannot_be_reactivated_or_claimed_after_the_cutoff(): void
    {
        [$bill, $referral] = $this->pendingReferrerBill();
        $code = $referral->referralCode;
        $code->update(['is_active' => false]);
        $lifecycle = app(ReferralLifecycle::class);
        $this->assertValidationField('referralCode', fn () => $lifecycle->issueCode($bill->student, $bill->schoolYear));
        $this->assertFalse($code->fresh()->is_active);
        $code->update(['is_active' => true]);
        $this->travel(15)->days();
        $this->assertValidationField('referralCode', fn () => $lifecycle->validateCode($code->code, $bill->schoolYear, $referral->referredApplication));
        $this->assertValidationField('referralCode', fn () => $lifecycle->issueCode($bill->student, $bill->schoolYear));
    }

    #[DataProvider('staleApplicationActions')]
    public function test_stale_application_actions_cannot_change_an_accepted_referral(string $action): void
    {
        Mail::fake();
        [$bill, $referral] = $this->pendingReferrerBill();
        $staleApplication = $referral->referredApplication;
        $student = $this->createStudent($staleApplication);
        $enrollment = $this->createEnrollment($student, $bill->schoolYear, 'grade_11', 'pending');
        app(ReferralLifecycle::class)->acceptApplication($staleApplication, $enrollment);
        Application::whereKey($staleApplication->id)->update(['status' => 'accepted']);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $request = Request::create('/', 'POST', ['reason' => 'Stale correction', 'note' => 'Stale rejection']);
        $request->setUserResolver(fn () => $admin);
        try {
            app()->call([app(ApplicationController::class), $action], [
                'request' => $request, 'application' => $staleApplication,
            ]);
            $this->fail('A stale action must be rejected after acceptance.');
        } catch (HttpException $exception) {
            $this->assertSame(422, $exception->getStatusCode());
        }
        $this->assertSame('accepted', $staleApplication->fresh()->status);
        $this->assertSame('accepted', $referral->fresh()->status);
        $this->assertSame('eligible', $referral->incentiveAwards()->sole()->status);
    }

    public static function staleApplicationActions(): array
    {
        return [['reject'], ['updateReferral']];
    }

    private function pendingReferrerBill(): array
    {
        Storage::fake('s3')->buildTemporaryUrlsUsing(fn () => 'https://example.test/proof.png');
        [$priorYear, $targetYear] = $this->createSchoolYears();
        $this->createReferralCampaign($targetYear);
        $targetYear->fees()->create(['name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);
        $voucher = Discount::create(['name' => 'Voucher', 'category' => 'voucher', 'type' => 'fixed', 'value' => 600, 'is_active' => true]);
        $student = $this->createStudent();
        $this->createEnrollment($student, $priorYear, 'grade_11', 'enrolled');
        $enrollment = $this->createEnrollment($student, $targetYear, 'grade_12', 'pending');
        $enrollment->update(['discount_id' => $voucher->id]);
        $lifecycle = app(ReferralLifecycle::class);
        $code = $lifecycle->issueCode($student, $targetYear);
        $application = $this->createReferralApplication($targetYear, 'new');
        $referral = $lifecycle->syncApplication($application, $code->code, $application->user);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/{$enrollment->id}/bill")->assertSuccessful();

        return [$enrollment->bill()->firstOrFail(), $referral, $cashier];
    }

    public static function paymentsBeforeReferralSuccess(): array
    {
        return [
            'unpaid bill receives the full remaining credit' => [0.0, 400.0],
            'partially paid bill receives only its unpaid balance' => [100.0, 300.0],
            'fully paid bill records qualification without a refund' => [400.0, 0.0],
        ];
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
            'ends_on' => now('Asia/Manila')->addDays(14)->toDateString(),
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
