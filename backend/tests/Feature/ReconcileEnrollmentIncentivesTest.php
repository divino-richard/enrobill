<?php

namespace Tests\Feature;

use App\Actions\ReconcileEnrollmentIncentives;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\BillAdjustment;
use App\Models\Discount;
use App\Models\Enrollment;
use App\Models\Freebie;
use App\Models\IncentiveAward;
use App\Models\Payment;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ReconcileEnrollmentIncentivesTest extends TestCase
{
    use RefreshDatabase;

    #[DataProvider('beneficiaryVoucherCombinations')]
    public function test_each_beneficiary_redeems_only_against_their_own_active_voucher(
        bool $referredHasVoucher,
        bool $referrerHasVoucher,
    ): void {
        $schoolYear = $this->createSchoolYear();
        $freebie = $this->createFreebie($schoolYear, IncentiveAward::TYPE_REFERRAL);
        $voucher = $this->createDiscount('SHS Voucher', 'voucher', 600);

        [$referredEnrollment, $referredBill, $referredAward] = $this->createBeneficiary(
            $schoolYear,
            $freebie,
            $voucher,
            'grade_11',
            IncentiveAward::BENEFICIARY_REFERRED_GRADE_11,
            $referredHasVoucher,
        );
        [$referrerEnrollment, $referrerBill, $referrerAward] = $this->createBeneficiary(
            $schoolYear,
            $freebie,
            $voucher,
            'grade_12',
            IncentiveAward::BENEFICIARY_REFERRER_GRADE_12,
            $referrerHasVoucher,
        );

        $reconcile = app(ReconcileEnrollmentIncentives::class);
        $reconcile($referredEnrollment);
        $reconcile($referrerEnrollment);

        $this->assertBeneficiaryResult($referredBill, $referredAward, $referredHasVoucher);
        $this->assertBeneficiaryResult($referrerBill, $referrerAward, $referrerHasVoucher);
    }

    /**
     * @return array<string, array{bool, bool}>
     */
    public static function beneficiaryVoucherCombinations(): array
    {
        return [
            'neither has a voucher' => [false, false],
            'only referred Grade 11 has a voucher' => [true, false],
            'only referrer Grade 12 has a voucher' => [false, true],
            'both have vouchers' => [true, true],
        ];
    }

    public function test_early_and_referral_awards_share_one_adjustment_and_retries_are_idempotent(): void
    {
        $schoolYear = $this->createSchoolYear();
        $earlyFreebie = $this->createFreebie(
            $schoolYear,
            IncentiveAward::TYPE_EARLY_ENROLLMENT,
            startsOn: now()->subDay()->toDateString(),
            endsOn: now()->addDay()->toDateString(),
        );
        $referralFreebie = $this->createFreebie($schoolYear, IncentiveAward::TYPE_REFERRAL);
        $voucher = $this->createDiscount('Overlap Voucher', 'voucher', 600);
        [$enrollment, $bill] = $this->createBilledEnrollment($schoolYear, 'grade_11', $voucher);
        $this->applyDiscount($bill, $voucher);

        IncentiveAward::create([
            'school_year_id' => $schoolYear->id,
            'student_id' => $enrollment->student_id,
            'enrollment_id' => $enrollment->id,
            'freebie_id' => $referralFreebie->id,
            'type' => IncentiveAward::TYPE_REFERRAL,
            'beneficiary' => IncentiveAward::BENEFICIARY_REFERRED_GRADE_11,
            'status' => IncentiveAward::STATUS_ELIGIBLE,
            'qualified_at' => now(),
        ]);

        $reconcile = app(ReconcileEnrollmentIncentives::class);
        $firstAdjustment = $reconcile($enrollment);
        $secondAdjustment = $reconcile($enrollment->fresh());

        $this->assertTrue($firstAdjustment?->is($secondAdjustment));
        $this->assertSame(1, $bill->adjustments()
            ->where('incentive_key', BillAdjustment::INCENTIVE_KEY_ZERO_TUITION)
            ->count());
        $this->assertSame('400.00', $firstAdjustment?->fresh()->amount);

        $awards = IncentiveAward::query()
            ->where('enrollment_id', $enrollment->id)
            ->orderBy('type')
            ->get();

        $this->assertCount(2, $awards);
        $this->assertEqualsCanonicalizing(
            [$earlyFreebie->id, $referralFreebie->id],
            $awards->pluck('freebie_id')->all(),
        );
        $this->assertSame(
            [IncentiveAward::STATUS_APPLIED],
            $awards->pluck('status')->unique()->values()->all(),
        );
        $this->assertSame(
            [$firstAdjustment?->id],
            $awards->pluck('bill_adjustment_id')->unique()->values()->all(),
        );
        $this->assertSame(1, $enrollment->student->notifications()
            ->where('category', 'billing')
            ->count());
    }

    public function test_partial_payment_caps_a_late_credit_at_the_verified_unpaid_base_net(): void
    {
        $schoolYear = $this->createSchoolYear();
        $freebie = $this->createFreebie($schoolYear, IncentiveAward::TYPE_REFERRAL);
        $voucher = $this->createDiscount('Partial Voucher', 'voucher', 600);
        [$enrollment, $bill] = $this->createBilledEnrollment($schoolYear, 'grade_11', $voucher);
        $this->applyDiscount($bill, $voucher);
        $award = $this->createReferralAward($enrollment, $freebie);
        $this->createVerifiedPayment($bill, 100);
        $bill->update(['amount_paid' => 100, 'status' => 'partial']);

        $adjustment = app(ReconcileEnrollmentIncentives::class)($enrollment);

        $this->assertSame('300.00', $adjustment?->amount);
        $this->assertSame(IncentiveAward::STATUS_APPLIED, $award->fresh()->status);
        $this->assertSame($adjustment?->id, $award->fresh()->bill_adjustment_id);
        $this->assertSame('100.00', $bill->fresh()->amount_paid);
        $this->assertSame('paid', $bill->fresh()->status);
        $this->assertSame(0.0, $bill->fresh()->amountDue());
    }

    public function test_fully_paid_late_award_is_recorded_without_a_zero_adjustment_or_refund(): void
    {
        $schoolYear = $this->createSchoolYear();
        $freebie = $this->createFreebie($schoolYear, IncentiveAward::TYPE_REFERRAL);
        $voucher = $this->createDiscount('Paid Voucher', 'voucher', 600);
        [$enrollment, $bill] = $this->createBilledEnrollment($schoolYear, 'grade_12', $voucher);
        $this->applyDiscount($bill, $voucher);
        $award = $this->createReferralAward(
            $enrollment,
            $freebie,
            IncentiveAward::BENEFICIARY_REFERRER_GRADE_12,
        );
        $this->createVerifiedPayment($bill, 400);
        $bill->update(['amount_paid' => 400, 'status' => 'paid']);

        $reconcile = app(ReconcileEnrollmentIncentives::class);
        $this->assertNull($reconcile($enrollment));
        $this->assertNull($reconcile($enrollment->fresh()));

        $this->assertSame(IncentiveAward::STATUS_APPLIED_NO_BALANCE, $award->fresh()->status);
        $this->assertNull($award->fresh()->bill_adjustment_id);
        $this->assertSame(0, $bill->adjustments()
            ->where('incentive_key', BillAdjustment::INCENTIVE_KEY_ZERO_TUITION)
            ->count());
        $this->assertSame('400.00', $bill->fresh()->amount_paid);
        $this->assertSame(1, $enrollment->student->notifications()
            ->where('category', 'billing')
            ->count());
    }

    public function test_existing_shared_adjustment_is_resized_once_when_ordinary_discounts_change(): void
    {
        $schoolYear = $this->createSchoolYear();
        $freebie = $this->createFreebie($schoolYear, IncentiveAward::TYPE_REFERRAL);
        $voucher = $this->createDiscount('Resize Voucher', 'voucher', 600);
        [$enrollment, $bill] = $this->createBilledEnrollment($schoolYear, 'grade_11', $voucher);
        $this->applyDiscount($bill, $voucher);
        $this->createReferralAward($enrollment, $freebie);

        $reconcile = app(ReconcileEnrollmentIncentives::class);
        $adjustment = $reconcile($enrollment);
        $this->assertSame('400.00', $adjustment?->amount);

        $ordinaryDiscount = $this->createDiscount('Ordinary Discount', 'discount', 150);
        $this->applyDiscount($bill, $ordinaryDiscount);
        $resized = $reconcile($enrollment->fresh());
        $retried = $reconcile($enrollment->fresh());

        $this->assertTrue($adjustment?->is($resized));
        $this->assertTrue($resized?->is($retried));
        $this->assertSame('250.00', $retried?->amount);
        $this->assertSame(1, $bill->adjustments()
            ->where('incentive_key', BillAdjustment::INCENTIVE_KEY_ZERO_TUITION)
            ->count());
        $this->assertSame(1, IncentiveAward::query()
            ->where('enrollment_id', $enrollment->id)
            ->count());
    }

    private function createSchoolYear(): SchoolYear
    {
        return SchoolYear::create([
            'school_year' => '2026-2027',
            'start_date' => now()->subMonth()->toDateString(),
            'end_date' => now()->addMonths(9)->toDateString(),
            'is_active' => true,
            'admission_open' => true,
            'downpayment_value' => 100,
            'installment_count' => 4,
        ]);
    }

    private function createFreebie(
        SchoolYear $schoolYear,
        string $type,
        ?string $startsOn = null,
        ?string $endsOn = null,
    ): Freebie {
        return Freebie::create([
            'school_year_id' => $schoolYear->id,
            'type' => $type,
            'name' => Str::headline($type).' Zero Tuition',
            'is_active' => true,
            'starts_on' => $startsOn,
            'ends_on' => $endsOn,
            'min_referrals' => $type === IncentiveAward::TYPE_REFERRAL ? 1 : null,
        ]);
    }

    private function createDiscount(string $name, string $category, float $amount): Discount
    {
        return Discount::create([
            'name' => $name,
            'category' => $category,
            'type' => 'fixed',
            'value' => $amount,
            'is_active' => true,
        ]);
    }

    /**
     * @return array{Enrollment, Bill, IncentiveAward}
     */
    private function createBeneficiary(
        SchoolYear $schoolYear,
        Freebie $freebie,
        Discount $voucher,
        string $yearLevel,
        string $beneficiary,
        bool $hasVoucher,
    ): array {
        [$enrollment, $bill] = $this->createBilledEnrollment(
            $schoolYear,
            $yearLevel,
            $hasVoucher ? $voucher : null,
        );
        if ($hasVoucher) {
            $this->applyDiscount($bill, $voucher);
        }

        $award = $this->createReferralAward($enrollment, $freebie, $beneficiary);

        return [$enrollment, $bill, $award];
    }

    /**
     * @return array{Enrollment, Bill}
     */
    private function createBilledEnrollment(
        SchoolYear $schoolYear,
        string $yearLevel,
        ?Discount $voucher,
    ): array {
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create([
            'user_id' => $user->id,
            'student_number' => 'STU-'.Str::upper(Str::random(12)),
            'status' => 'enrolled',
            'first_name' => 'Test',
            'last_name' => 'Beneficiary',
        ]);
        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'school_year_id' => $schoolYear->id,
            'discount_id' => $voucher?->id,
            'track' => 'stem',
            'year_level' => $yearLevel,
            'status' => 'enrolled',
            'enrolled_at' => now(),
        ]);
        $bill = Bill::create([
            'student_id' => $student->id,
            'school_year_id' => $schoolYear->id,
            'enrollment_id' => $enrollment->id,
            'total' => 1000,
            'amount_paid' => 0,
            'status' => 'unpaid',
        ]);

        return [$enrollment, $bill];
    }

    private function createReferralAward(
        Enrollment $enrollment,
        Freebie $freebie,
        string $beneficiary = IncentiveAward::BENEFICIARY_REFERRED_GRADE_11,
    ): IncentiveAward {
        return IncentiveAward::create([
            'school_year_id' => $enrollment->school_year_id,
            'student_id' => $enrollment->student_id,
            'enrollment_id' => $enrollment->id,
            'freebie_id' => $freebie->id,
            'type' => IncentiveAward::TYPE_REFERRAL,
            'beneficiary' => $beneficiary,
            'status' => IncentiveAward::STATUS_ELIGIBLE,
            'qualified_at' => now(),
        ]);
    }

    private function applyDiscount(Bill $bill, Discount $discount): BillAdjustment
    {
        return $bill->adjustments()->create([
            'discount_id' => $discount->id,
            'label' => $discount->name,
            'type' => $discount->type,
            'value' => $discount->value,
            'amount' => $discount->value,
        ]);
    }

    private function createVerifiedPayment(Bill $bill, float $amount): Payment
    {
        return Payment::create([
            'bill_id' => $bill->id,
            'amount' => $amount,
            'method' => 'cash',
            'status' => 'verified',
            'reference' => 'PAY-'.Str::upper(Str::random(12)),
            'paid_at' => now()->toDateString(),
        ]);
    }

    private function assertBeneficiaryResult(Bill $bill, IncentiveAward $award, bool $hasVoucher): void
    {
        $incentive = $bill->adjustments()
            ->where('incentive_key', BillAdjustment::INCENTIVE_KEY_ZERO_TUITION)
            ->first();

        if ($hasVoucher) {
            $this->assertNotNull($incentive);
            $this->assertSame('400.00', $incentive->amount);
            $this->assertSame(IncentiveAward::STATUS_APPLIED, $award->fresh()->status);
            $this->assertSame($incentive->id, $award->fresh()->bill_adjustment_id);

            return;
        }

        $this->assertNull($incentive);
        $this->assertSame(IncentiveAward::STATUS_ELIGIBLE, $award->fresh()->status);
        $this->assertNull($award->fresh()->bill_adjustment_id);
    }
}
