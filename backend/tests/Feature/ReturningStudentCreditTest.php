<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Bill;
use App\Models\DroppingAssessment;
use App\Models\DroppingPolicy;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\StudentCredit;
use App\Models\StudentCreditAllocation;
use App\Models\User;
use App\Services\StudentCreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReturningStudentCreditTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(float $paid = 2100, float $charge = 2100, float $fees = 18421.25): array
    {
        $this->travelTo(Carbon::parse('2027-06-01', 'Asia/Manila'));
        $admin = User::factory()->create(['role' => Role::Admin]);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'C-'.$user->id,
            'status' => 'dropped', 'first_name' => 'Returning', 'last_name' => 'Student']);
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        $oldYear = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31',
            'is_active' => true, 'admission_open' => true, 'downpayment_value' => 170, 'installment_count' => 12]);
        $year->fees()->create(['name' => 'Tuition', 'amount' => $fees, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);
        $source = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id,
            'status' => 'dropped', 'track' => 'stem', 'year_level' => 'grade_11']);
        $oldBill = Bill::create(['student_id' => $student->id, 'enrollment_id' => $source->id, 'school_year_id' => $oldYear->id,
            'total' => 18421.25, 'amount_paid' => $paid, 'status' => $paid >= $charge ? 'paid' : 'partial']);
        $request = DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $source->id,
            'status' => 'confirmed', 'effective_date' => '2026-07-01', 'snapshot' => [], 'submissions' => [], 'events' => []]);
        $policy = DroppingPolicy::create(['school_year_id' => $oldYear->id, 'version' => 1, 'enabled' => true, 'periods' => []]);
        DroppingAssessment::create(['request_id' => $request->id, 'enrollment_id' => $source->id, 'bill_id' => $oldBill->id,
            'policy_id' => $policy->id, 'approved_by' => $admin->id, 'final_charge' => $charge,
            'snapshot' => ['category' => 'paying', 'finalCharge' => $charge]]);
        if ($paid > 0) {
            $oldBill->payments()->create(['amount' => $paid, 'status' => 'verified', 'method' => 'cash', 'paid_at' => '2026-07-01']);
        }
        if ($paid > $charge) {
            StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $oldBill->id,
                'amount' => $paid - $charge, 'issued_by' => $admin->id]);
        }

        return compact('student', 'source', 'oldBill', 'year', 'admin', 'cashier');
    }

    private function startReturn(array $fixture, bool $selfService = false): Enrollment
    {
        extract($fixture);
        $response = $selfService
            ? $this->actingAs($student->user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])
            : $this->actingAs($admin)->postJson("/api/admin/students/$student->id/returning-enrollments",
                ['schoolYearId' => $year->id, 'program' => 'stem', 'yearLevel' => 'grade_11', 'discountId' => null]);
        $response->assertSuccessful();

        return Enrollment::findOrFail($response->json('data.id'));
    }

    public function test_paid_dropping_charge_is_credited_once_without_changing_the_old_bill(): void
    {
        $fixture = $this->fixture();
        extract($fixture);
        $before = $oldBill->fresh()->getAttributes();
        $return = $this->startReturn($fixture);
        $url = "/api/admin/enrollments/$return->id/bill";
        $response = $this->actingAs($cashier)->postJson($url)->assertSuccessful()
            ->assertJsonPath('data.balance', 16321.25)
            ->assertJsonPath('data.amountPaid', 0)
            ->assertJsonPath('data.appliedCredits.0.label', 'Returning student credit')
            ->assertJsonPath('data.appliedCredits.0.amount', 2100);
        $billId = $response->json('data.id');
        $this->postJson($url)->assertSuccessful()->assertJsonPath('data.id', $billId)->assertJsonPath('data.balance', 16321.25);
        $this->assertSame('enrolled', $return->fresh()->status);
        $this->assertSame($before, $oldBill->fresh()->getAttributes());
        $this->assertSame(1, $oldBill->payments()->count());
        $this->assertDatabaseCount('student_credits', 1);
        $this->assertDatabaseCount('student_credit_allocations', 1);
        $this->assertSame($cashier->id, StudentCredit::first()->issued_by);
        $bill = Bill::findOrFail($billId);
        $this->assertEquals(16321.25, collect($bill->installmentSchedule())->sum('balance'));
        $this->assertSame(0.0, $bill->enrollmentPaymentRemaining());
    }

    public function test_self_service_return_keeps_excess_and_returning_credits_separate(): void
    {
        $fixture = $this->fixture(3000);
        extract($fixture);
        $return = $this->startReturn($fixture, true);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful()
            ->assertJsonPath('data.creditApplied', 3000)->assertJsonPath('data.balance', 15421.25);
        $this->assertDatabaseHas('student_credits', ['source_bill_id' => $oldBill->id, 'kind' => 'excess_payment', 'amount' => 900]);
        $this->assertDatabaseHas('student_credits', ['source_bill_id' => $oldBill->id, 'kind' => 'returning_student', 'amount' => 2100]);
        $this->assertSame(900.0, (float) $oldBill->fresh()->issuedCredit->amount);
        $this->assertSame(0.0, app(StudentCreditService::class)->availableFor($student));
    }

    public function test_pending_or_rejected_payments_cannot_unlock_or_inflate_the_credit(): void
    {
        $fixture = $this->fixture(1600);
        extract($fixture);
        $pending = $oldBill->payments()->create(['amount' => 500, 'status' => 'pending', 'method' => 'gcash', 'paid_at' => '2027-06-01']);
        $oldBill->payments()->create(['amount' => 900, 'status' => 'rejected', 'method' => 'cash', 'paid_at' => '2027-06-01']);
        $this->actingAs($student->user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
        $this->assertDatabaseCount('student_credits', 0);
        $this->actingAs($cashier)->postJson("/api/admin/bills/$oldBill->id/payments/$pending->id/verify")->assertSuccessful();
        $return = $this->startReturn($fixture);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful()->assertJsonPath('data.creditApplied', 2100);
    }

    public function test_credit_used_to_settle_dropping_charges_is_not_issued_again(): void
    {
        $fixture = $this->fixture(1600);
        extract($fixture);
        $earlierYear = SchoolYear::create(['school_year' => '2025-2026', 'start_date' => '2025-06-01', 'end_date' => '2026-03-31']);
        $earlierBill = Bill::create(['student_id' => $student->id, 'school_year_id' => $earlierYear->id, 'total' => 0, 'amount_paid' => 0, 'status' => 'paid']);
        $credit = StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $earlierBill->id, 'amount' => 500, 'issued_by' => $admin->id]);
        StudentCreditAllocation::create(['credit_id' => $credit->id, 'bill_id' => $oldBill->id, 'amount' => 500]);
        $oldBill->recalculate();
        $return = $this->startReturn($fixture);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful()->assertJsonPath('data.creditApplied', 1600);
        $this->assertDatabaseHas('student_credits', ['source_bill_id' => $oldBill->id, 'kind' => 'returning_student', 'amount' => 1600]);
    }

    public function test_credit_is_capped_to_the_new_balance_and_unused_value_is_preserved(): void
    {
        $fixture = $this->fixture(fees: 1000);
        extract($fixture);
        $return = $this->startReturn($fixture);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful()
            ->assertJsonPath('data.balance', 0)->assertJsonPath('data.creditApplied', 1000)->assertJsonPath('data.availableCredit', 1100);
        $bill = $return->fresh()->bill;
        $bill->adjustments()->create(['label' => 'Additional benefit', 'type' => 'fixed', 'value' => 500, 'amount' => 500]);
        $bill = $bill->fresh();
        $bill->recalculate();
        $this->assertSame(500.0, $bill->creditApplied());
        $this->assertSame(1600.0, app(StudentCreditService::class)->availableFor($student));
        $this->assertSame(0.0, $bill->balance());
    }

    public function test_existing_return_bills_are_not_retroactively_credited(): void
    {
        $fixture = $this->fixture();
        extract($fixture);
        $return = $this->startReturn($fixture);
        $bill = Bill::create(['student_id' => $student->id, 'enrollment_id' => $return->id, 'school_year_id' => $year->id,
            'total' => 1000, 'amount_paid' => 0, 'status' => 'unpaid']);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful()
            ->assertJsonPath('data.id', $bill->id)->assertJsonPath('data.creditApplied', 0)->assertJsonPath('data.balance', 1000);
        $this->assertDatabaseCount('student_credits', 0);
    }

    public function test_no_credit_is_created_when_a_drop_has_no_verified_cash_payments(): void
    {
        $fixture = $this->fixture(0, 0);
        extract($fixture);
        $return = $this->startReturn($fixture);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful()
            ->assertJsonPath('data.creditApplied', 0)->assertJsonPath('data.balance', 18421.25);
        $this->assertDatabaseCount('student_credits', 0);
        $this->assertSame('pending', $return->fresh()->status);
    }

    public function test_reissuing_or_reallocating_cannot_reuse_the_same_paid_charges(): void
    {
        $fixture = $this->fixture();
        extract($fixture);
        $return = $this->startReturn($fixture);
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful();
        $bill = $return->fresh()->bill;
        $service = app(StudentCreditService::class);
        DB::transaction(fn () => $service->issueReturningCredit($bill, $source, $cashier->id));
        $service->applyToBill($bill, $cashier->id);
        $this->assertSame(2100.0, $bill->creditApplied());
        $this->assertDatabaseCount('student_credits', 1);
        $this->assertDatabaseCount('student_credit_allocations', 1);
    }

    public function test_migration_preserves_existing_excess_credit_and_allocation_amounts(): void
    {
        $fixture = $this->fixture();
        extract($fixture);
        $migration = require database_path('migrations/2026_10_19_000000_add_returning_student_credit_kind.php');
        $migration->down();
        $credit = StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $oldBill->id,
            'amount' => 900, 'issued_by' => $admin->id]);
        StudentCreditAllocation::create(['credit_id' => $credit->id, 'bill_id' => $oldBill->id, 'amount' => 400, 'released_amount' => 100]);
        $before = DB::table('student_credit_allocations')->get()->toJson();
        $migration->up();
        $this->assertSame('excess_payment', $credit->fresh()->kind);
        $this->assertSame(900.0, (float) $credit->fresh()->amount);
        $this->assertSame(600.0, $credit->fresh()->remaining());
        $this->assertSame($before, DB::table('student_credit_allocations')->get()->toJson());
    }
}
