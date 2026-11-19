<?php

namespace Tests\Feature;

use App\Actions\EnsureEnrollment;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\SchoolYear;
use App\Models\SemesterStanding;
use App\Models\Student;
use App\Models\StudentCredit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProgressionSettlementGateTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(string $grade = 'grade_11'): array
    {
        $this->travelTo(Carbon::parse('2027-07-01 10:00:00', 'Asia/Manila'));
        $admin = User::factory()->create(['role' => Role::Admin]);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $user = User::factory()->create(['role' => Role::Student]);
        // Legacy school years can lack dates; their canonical keys still order them.
        $oldYear = SchoolYear::create(['school_year' => '2026-2027', 'is_active' => true, 'progression_open' => true]);
        $nextYear = SchoolYear::create(['school_year' => '2027-2028', 'fees_published_at' => now(),
            'downpayment_value' => 200, 'installment_count' => 4]);
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        $nextYear->fees()->create(['name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'SETTLEMENT-'.$user->id,
            'first_name' => 'Regular', 'last_name' => 'Student', 'status' => 'enrolled',
            'track_or_strand' => 'stem', 'year_level' => $grade, 'school_year' => $oldYear->school_year]);
        $source = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id,
            'track' => 'stem', 'year_level' => $grade, 'status' => 'enrolled', 'enrolled_at' => now()]);
        foreach (['first', 'second'] as $semester) {
            SemesterStanding::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id,
                'semester' => $semester, 'clearance_cleared' => true, 'grades_passed' => true]);
        }
        $bill = $this->billFor($student, $oldYear, $source);

        return compact('admin', 'cashier', 'user', 'student', 'source', 'oldYear', 'nextYear', 'bill');
    }

    private function billFor(Student $student, SchoolYear $year, ?Enrollment $enrollment = null, int $total = 100): Bill
    {
        return Bill::create(['student_id' => $student->id, 'school_year_id' => $year->id,
            'enrollment_id' => $enrollment?->id, 'total' => $total, 'amount_paid' => 0, 'status' => 'unpaid']);
    }

    private function pay(Bill $bill, int $amount, string $status = 'verified'): void
    {
        $bill->payments()->create(['amount' => $amount, 'status' => $status, 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
    }

    private function legacyPending(Student $student, SchoolYear $year): Enrollment
    {
        return Enrollment::withoutEvents(fn () => Enrollment::create([
            'student_id' => $student->id, 'school_year_id' => $year->id,
            'track' => 'stem', 'year_level' => 'grade_12', 'status' => 'pending',
        ]));
    }

    public static function unsettledPayments(): array
    {
        return [
            'unpaid' => [0, 'verified'],
            'partially verified' => [40, 'verified'],
            'pending proof' => [100, 'pending'],
            'rejected proof' => [100, 'rejected'],
        ];
    }

    #[DataProvider('unsettledPayments')]
    public function test_unsettled_prior_bill_blocks_regular_promotion(int $amount, string $status): void
    {
        extract($this->fixture());
        if ($amount > 0) {
            $this->pay($bill, $amount, $status);
        }

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 0);

        $this->assertSame('grade_11', $student->fresh()->year_level);
        $this->assertSame(0, $student->progressionDecisions()->count());
        $this->assertSame(1, $student->enrollments()->count());
    }

    public function test_cached_paid_status_cannot_make_unverified_money_count(): void
    {
        extract($this->fixture());
        $this->pay($bill, 100, 'pending');
        $bill->update(['amount_paid' => 100, 'status' => 'paid']);

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 0);
        $this->assertSame('grade_11', $student->fresh()->year_level);
    }

    public function test_verified_settlement_allows_promotion_and_pending_next_year_enrollment(): void
    {
        extract($this->fixture());
        $this->pay($bill, 100, 'pending');
        $payment = $bill->payments()->firstOrFail();
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")
            ->assertSuccessful();

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 1);
        $this->postJson('/api/admin/progression/materialize')->assertOk()->assertJsonPath('data.materialized', 1);
        $this->postJson('/api/admin/progression/materialize')->assertOk()->assertJsonPath('data.materialized', 0);

        $this->assertSame('grade_12', $student->fresh()->year_level);
        $this->assertDatabaseHas('enrollments', ['student_id' => $student->id,
            'school_year_id' => $nextYear->id, 'year_level' => 'grade_12', 'status' => 'pending']);
        $this->assertSame('grade_11', $source->fresh()->year_level);
        $this->assertSame(1, $student->bills()->count());

        $target = $student->enrollments()->where('school_year_id', $nextYear->id)->firstOrFail();
        $newBillId = $this->actingAs($cashier)->postJson("/api/admin/enrollments/$target->id/bill")
            ->assertSuccessful()->json('data.id');
        $this->postJson("/api/admin/bills/$newBillId/payments", [
            'amount' => 200, 'method' => 'cash', 'paidAt' => '2027-07-01',
        ])->assertSuccessful();
        $this->assertSame('enrolled', $target->fresh()->status);
    }

    public function test_debt_created_after_promotion_blocks_materialization_until_settled(): void
    {
        extract($this->fixture());
        $this->pay($bill, 100);
        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 1);
        $bill->update(['total' => 150]);
        $bill->recalculate();

        $this->postJson('/api/admin/progression/materialize')->assertOk()->assertJsonPath('data.materialized', 0);
        $this->assertSame(1, $student->enrollments()->count());
        $this->assertNull($student->progressionDecisions()->firstOrFail()->materialized_at);

        $this->pay($bill, 50);
        $this->postJson('/api/admin/progression/materialize')->assertOk()->assertJsonPath('data.materialized', 1);
    }

    public function test_older_outstanding_bill_blocks_even_when_latest_year_is_settled(): void
    {
        extract($this->fixture());
        $this->pay($bill, 100);
        $olderYear = SchoolYear::create(['school_year' => '2025-2026']);
        $olderBill = $this->billFor($student, $olderYear);

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 0);
        $this->pay($olderBill, 100);
        $this->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 1);
    }

    public function test_direct_enrollment_creation_cannot_bypass_prior_year_debt(): void
    {
        extract($this->fixture());

        $this->expectException(ValidationException::class);
        app(EnsureEnrollment::class)($student, $nextYear, $admin->id);
    }

    public function test_student_profile_edit_cannot_advance_grade_while_prior_balance_is_unsettled(): void
    {
        extract($this->fixture());
        $payload = ['firstName' => 'Regular', 'lastName' => 'Student', 'status' => 'enrolled',
            'yearLevel' => 'grade_12', 'schoolYear' => $nextYear->school_year];

        $this->actingAs($admin)->putJson("/api/admin/students/$student->id", $payload)->assertUnprocessable();
        $this->assertSame('grade_11', $student->fresh()->year_level);
        $this->assertSame($oldYear->school_year, $student->fresh()->school_year);

        $this->pay($bill, 100);
        $this->putJson("/api/admin/students/$student->id", $payload)->assertSuccessful();
        $this->assertSame('grade_12', $student->fresh()->year_level);
    }

    public function test_omitting_default_pending_status_cannot_bypass_the_creation_guard(): void
    {
        extract($this->fixture());

        $this->expectException(ValidationException::class);
        Enrollment::create(['student_id' => $student->id, 'school_year_id' => $nextYear->id,
            'track' => 'stem', 'year_level' => 'grade_12']);
    }

    public function test_clearing_the_profile_grade_does_not_bypass_settlement_on_the_next_edit(): void
    {
        extract($this->fixture());
        $payload = ['firstName' => 'Regular', 'lastName' => 'Student', 'status' => 'enrolled',
            'yearLevel' => null, 'schoolYear' => $oldYear->school_year];
        $this->actingAs($admin)->putJson("/api/admin/students/$student->id", $payload)->assertSuccessful();
        $this->putJson("/api/admin/students/$student->id", [...$payload, 'yearLevel' => 'grade_12'])
            ->assertUnprocessable();
        $this->assertSame('grade_11', $source->fresh()->year_level);
    }

    public function test_profile_school_year_cannot_advance_while_prior_bills_are_unsettled(): void
    {
        extract($this->fixture());
        $this->actingAs($admin)->putJson("/api/admin/students/$student->id", [
            'firstName' => 'Regular', 'lastName' => 'Student', 'status' => 'enrolled',
            'yearLevel' => 'grade_11', 'schoolYear' => $nextYear->school_year,
        ])->assertUnprocessable();
        $this->assertSame($oldYear->school_year, $student->fresh()->school_year);
    }

    public function test_profile_status_edit_cannot_activate_a_legacy_pending_student_with_prior_debt(): void
    {
        extract($this->fixture());
        $pending = $this->legacyPending($student, $nextYear);
        $student->update(['status' => 'admitted', 'year_level' => 'grade_12', 'school_year' => $nextYear->school_year]);

        $this->actingAs($admin)->putJson("/api/admin/students/$student->id", [
            'firstName' => 'Regular', 'lastName' => 'Student', 'status' => 'enrolled',
            'yearLevel' => 'grade_12', 'schoolYear' => $nextYear->school_year,
        ])->assertUnprocessable();

        $this->assertSame('admitted', $student->fresh()->status);
        $this->assertSame('pending', $pending->fresh()->status);
    }

    public function test_legacy_pending_enrollment_cannot_be_billed_until_prior_debt_is_settled(): void
    {
        extract($this->fixture());
        $pending = $this->legacyPending($student, $nextYear);

        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$pending->id/bill")->assertUnprocessable();
        $this->assertSame(1, $student->bills()->count());
        $this->assertSame('pending', $pending->fresh()->status);

        $this->pay($bill, 100);
        $this->postJson("/api/admin/enrollments/$pending->id/bill")->assertSuccessful();
        $this->assertSame(2, $student->bills()->count());
        $this->assertSame('pending', $pending->fresh()->status);
    }

    public function test_current_downpayment_cannot_activate_a_legacy_pending_enrollment_with_prior_debt(): void
    {
        extract($this->fixture());
        $pending = $this->legacyPending($student, $nextYear);
        $currentBill = $this->billFor($student, $nextYear, $pending, 1000);
        $currentBill->installments()->create(['sequence' => 1, 'label' => Bill::DOWNPAYMENT_LABEL,
            'amount' => 200, 'due_date' => '2027-07-01']);
        $this->pay($currentBill, 200);

        $currentBill->fresh()->settleEnrollment();
        $this->assertSame('pending', $pending->fresh()->status);
        $this->assertNull($pending->fresh()->enrolled_at);
        $this->assertFalse($pending->fresh()->canActivate());

        $this->pay($bill, 100);
        $currentBill->fresh()->settleEnrollment();
        $this->assertSame('enrolled', $pending->fresh()->status);
        $this->assertNotNull($pending->fresh()->enrolled_at);
    }

    public function test_unallocated_student_credit_does_not_settle_a_prior_bill(): void
    {
        extract($this->fixture());
        StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $bill->id,
            'amount' => 500, 'issued_by' => $admin->id]);

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 0);
        $this->assertSame('grade_11', $student->fresh()->year_level);
    }

    public function test_applied_adjustments_can_fully_settle_the_previous_year(): void
    {
        extract($this->fixture());
        $bill->adjustments()->create(['label' => 'Applied school benefit', 'type' => 'fixed', 'value' => 100, 'amount' => 100]);
        $bill->recalculate();

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 1);
        $this->postJson('/api/admin/progression/materialize')->assertOk()->assertJsonPath('data.materialized', 1);
    }

    public function test_only_unreleased_applied_credit_counts_toward_settlement(): void
    {
        extract($this->fixture());
        $olderYear = SchoolYear::create(['school_year' => '2025-2026']);
        $creditSource = $this->billFor($student, $olderYear);
        $this->pay($creditSource, 200);
        $credit = StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $creditSource->id,
            'amount' => 100, 'issued_by' => $admin->id]);
        $credit->allocations()->create(['bill_id' => $bill->id, 'amount' => 100,
            'released_amount' => 20, 'allocated_by' => $admin->id]);
        $bill->recalculate();

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 0);
        $this->pay($bill, 20);
        $this->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'promote',
        ])->assertOk()->assertJsonPath('data.decided', 1);
    }

    public function test_future_dateless_bill_does_not_block_an_earlier_year_enrollment(): void
    {
        extract($this->fixture());
        $this->pay($bill, 100);
        $futureYear = SchoolYear::create(['school_year' => '2028-2029']);
        $this->billFor($student, $futureYear);

        $enrollment = app(EnsureEnrollment::class)($student, $nextYear, $admin->id);

        $this->assertSame('pending', $enrollment->status);
        $this->assertSame($nextYear->id, $enrollment->school_year_id);
    }

    public function test_roster_exposes_balance_blockers_for_an_academically_cleared_student(): void
    {
        extract($this->fixture());
        $this->pay($bill, 40);

        $response = $this->actingAs($admin)->getJson('/api/admin/progression/students')->assertOk()
            ->assertJsonPath('data.0.studentId', $student->id)
            ->assertJsonPath('data.0.eligible', false)
            ->assertJsonPath('data.0.settlementBalance', fn ($value) => (is_int($value) || is_float($value)) && (float) $value === 60.0);
        $this->assertIsArray($response->json('data.0.settlementBlockers'));
        $this->assertNotEmpty($response->json('data.0.settlementBlockers'));

        $this->pay($bill, 60);
        $this->getJson('/api/admin/progression/students')->assertOk()
            ->assertJsonPath('data.0.eligible', true)
            ->assertJsonPath('data.0.settlementBalance', fn ($value) => (is_int($value) || is_float($value)) && (float) $value === 0.0)
            ->assertJsonPath('data.0.settlementBlockers', []);
    }

    public function test_summary_excludes_balance_blocked_decisions_from_ready_to_enroll(): void
    {
        extract($this->fixture());
        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'retain',
        ])->assertOk()->assertJsonPath('data.decided', 1);

        $this->getJson('/api/admin/progression')->assertOk()
            ->assertJsonPath('data.readyToEnroll', 0)->assertJsonPath('data.blockedByBalance', 1);
        $this->pay($bill, 100);
        $this->getJson('/api/admin/progression')->assertOk()
            ->assertJsonPath('data.readyToEnroll', 1)->assertJsonPath('data.blockedByBalance', 0);
    }

    public function test_prior_year_carry_forward_stays_blocked_until_verified_settlement(): void
    {
        extract($this->fixture());
        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'retain',
        ])->assertOk()->assertJsonPath('data.decided', 1);
        $oldYear->update(['is_active' => false, 'progression_open' => false]);
        $nextYear->update(['is_active' => true, 'progression_open' => false]);
        $this->pay($bill, 100, 'pending');

        $this->getJson('/api/admin/progression')->assertOk()
            ->assertJsonPath('data.carryForward.count', 0)
            ->assertJsonPath('data.carryForward.blockedByBalance', 1);
        $this->postJson('/api/admin/progression/materialize', ['sourceSchoolYearId' => $oldYear->id])
            ->assertOk()->assertJsonPath('data.materialized', 0);

        $payment = $bill->payments()->firstOrFail();
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")->assertSuccessful();
        $this->actingAs($admin)->getJson('/api/admin/progression')->assertOk()
            ->assertJsonPath('data.carryForward.count', 1)
            ->assertJsonPath('data.carryForward.blockedByBalance', 0);
        $this->postJson('/api/admin/progression/materialize', ['sourceSchoolYearId' => $oldYear->id])
            ->assertOk()->assertJsonPath('data.materialized', 1);
    }

    public function test_retention_decision_is_allowed_but_next_year_enrollment_requires_settlement(): void
    {
        extract($this->fixture());
        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'retain',
        ])->assertOk()->assertJsonPath('data.decided', 1);
        $this->assertSame('grade_11', $student->fresh()->year_level);
        $this->postJson('/api/admin/progression/materialize')->assertOk()->assertJsonPath('data.materialized', 0);
        $this->assertSame(1, $student->enrollments()->count());

        $this->pay($bill, 100);
        $this->postJson('/api/admin/progression/materialize')->assertOk()->assertJsonPath('data.materialized', 1);
        $this->assertDatabaseHas('enrollments', ['student_id' => $student->id,
            'school_year_id' => $nextYear->id, 'year_level' => 'grade_11', 'status' => 'pending']);
    }

    public function test_outstanding_balance_does_not_change_the_existing_graduation_policy(): void
    {
        extract($this->fixture('grade_12'));

        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'graduate',
        ])->assertOk()->assertJsonPath('data.decided', 1);

        $this->assertSame('graduated', $student->fresh()->status);
        $this->assertSame('completed', $source->fresh()->status);
        $this->assertSame(1, $student->enrollments()->count());
    }

    public function test_reverting_graduation_restores_a_previously_active_enrollment_despite_older_debt(): void
    {
        extract($this->fixture('grade_12'));
        $this->pay($bill, 100);
        $olderYear = SchoolYear::create(['school_year' => '2025-2026']);
        $this->billFor($student, $olderYear);
        $this->actingAs($admin)->postJson('/api/admin/progression/decide', [
            'studentIds' => [$student->id], 'decision' => 'graduate',
        ])->assertOk()->assertJsonPath('data.decided', 1);
        $decision = $student->progressionDecisions()->firstOrFail();

        $this->postJson('/api/admin/progression/revert', ['decisionIds' => [$decision->id]])
            ->assertOk()->assertJsonPath('data.reverted', 1);

        $this->assertSame('enrolled', $student->fresh()->status);
        $this->assertSame('enrolled', $source->fresh()->status);
        $this->assertSame(1, $student->enrollments()->count());
        $this->assertSame(0, $student->progressionDecisions()->count());
    }
}
