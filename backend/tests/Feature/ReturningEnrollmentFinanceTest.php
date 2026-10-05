<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Bill;
use App\Models\Discount;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\StudentCredit;
use App\Models\User;
use App\Services\PaymentArrangementService;
use App\Services\StudentCreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReturningEnrollmentFinanceTest extends TestCase
{
    use RefreshDatabase;

    private function student(): Student
    {
        $user = User::factory()->create(['role' => Role::Student]);

        return Student::create(['user_id' => $user->id, 'student_number' => 'RET-'.$user->id,
            'first_name' => 'Returning', 'last_name' => 'Student', 'status' => 'dropped']);
    }

    private function setupReturn(float $oldDebt = 100): array
    {
        $this->travelTo(Carbon::parse('2027-06-01 10:00:00', 'Asia/Manila'));
        Storage::fake('s3')->buildTemporaryUrlsUsing(fn ($path, $expiration, $options) => 'https://example.test/proof');
        $student = $this->student();
        $oldYear = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31',
            'is_active' => true, 'downpayment_type' => 'fixed', 'downpayment_value' => 200, 'installment_count' => 4]);
        $old = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id,
            'status' => 'dropped', 'track' => 'stem', 'year_level' => 'grade_11']);
        $bill = Bill::create(['student_id' => $student->id, 'enrollment_id' => $old->id, 'school_year_id' => $oldYear->id,
            'total' => $oldDebt, 'amount_paid' => 0, 'status' => $oldDebt > 0 ? 'unpaid' : 'paid']);
        Program::firstOrCreate(['code' => 'abm'], ['name' => 'Accountancy', 'category' => 'academic', 'is_active' => true]);
        $year->fees()->create(['name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $cashier = User::factory()->create(['role' => Role::Cashier]);

        return compact('student', 'old', 'bill', 'year', 'admin', 'cashier');
    }

    private function payload(SchoolYear $year): array
    {
        return ['schoolYearId' => $year->id, 'program' => 'abm', 'yearLevel' => 'grade_11', 'discountId' => null, 'droppingCategory' => 'paying'];
    }

    public function test_return_is_idempotent_keeps_history_and_requires_both_balances_for_activation(): void
    {
        extract($this->setupReturn());
        $url = "/api/admin/students/$student->id/returning-enrollments";
        $this->actingAs($student->user)->postJson($url, $this->payload($year))->assertForbidden();
        $response = $this->actingAs($admin)->postJson($url, $this->payload($year))->assertSuccessful()->assertJsonPath('data.status', 'pending');
        $id = $response->json('data.id');
        $this->postJson($url, $this->payload($year))->assertSuccessful()->assertJsonPath('data.id', $id);
        $this->assertEquals(2, $student->enrollments()->count());
        $this->assertSame('dropped', $old->fresh()->status);
        $this->assertSame('grade_11', $old->fresh()->year_level);
        $this->putJson("/api/admin/enrollments/$old->id", ['status' => 'pending'])->assertUnprocessable();
        $this->getJson("/api/admin/bills/$bill->id")->assertOk()->assertJsonPath('data.student.track', 'stem');
        $return = Enrollment::findOrFail($id);
        $newBill = $return->bill;
        $this->assertSame(1000.0, $newBill->netTotal());
        $this->putJson("/api/admin/enrollments/$id", ['status' => 'enrolled'])->assertUnprocessable();
        $this->actingAs($cashier)->postJson("/api/admin/bills/$newBill->id/payments", [
            'amount' => 200, 'method' => 'cash', 'paidAt' => '2027-06-01',
        ])->assertSuccessful();
        $this->assertSame('pending', $return->fresh()->status);
        $this->actingAs($admin)->putJson("/api/admin/enrollments/$id", ['status' => 'enrolled'])->assertUnprocessable();
        $this->putJson("/api/admin/students/$student->id", ['firstName' => 'Returning', 'lastName' => 'Student', 'status' => 'enrolled'])->assertUnprocessable();
        $this->actingAs($cashier)->putJson("/api/admin/bills/$bill->id/payment-arrangement", [
            'remarks' => 'Approved monthly payment', 'installments' => [['dueDate' => '2027-06-15', 'amount' => 100]],
        ])->assertSuccessful();
        $this->assertSame('enrolled', $return->fresh()->status);
        $this->assertSame('dropped', $old->fresh()->status);
        $this->assertSame(100.0, $bill->fresh()->balance());
        $this->travelTo(Carbon::parse('2027-06-16', 'Asia/Manila'));
        $this->assertFalse(app(PaymentArrangementService::class)->covers($bill->fresh()));
        $this->assertSame('enrolled', $return->fresh()->status);
    }

    public function test_arrangements_require_full_balance_and_overdue_installments_must_be_paid(): void
    {
        extract($this->setupReturn(100));
        $this->actingAs($admin)->putJson("/api/admin/bills/$bill->id/payment-arrangement", [
            'remarks' => 'Insufficient', 'installments' => [['dueDate' => '2027-06-02', 'amount' => 99]],
        ])->assertUnprocessable();
        $this->putJson("/api/admin/bills/$bill->id/payment-arrangement", [
            'remarks' => 'Two installments', 'installments' => [['dueDate' => '2027-06-02', 'amount' => 40], ['dueDate' => '2027-06-20', 'amount' => 60]],
        ])->assertSuccessful();
        $this->assertTrue(app(PaymentArrangementService::class)->covers($bill->fresh()));
        $this->assertSame(40.0, $bill->fresh()->amountDue());
        $this->actingAs($student->user)->getJson('/api/me/bills')->assertOk()
            ->assertJsonPath('data.0.installments.0.dueDate', '2027-06-02')
            ->assertJsonPath('data.0.installments.0.balance', 40);
        $this->actingAs($admin);
        $this->travelTo(Carbon::parse('2027-06-03', 'Asia/Manila'));
        $this->assertFalse(app(PaymentArrangementService::class)->covers($bill->fresh()));
        $bill->payments()->create(['amount' => 40, 'method' => 'cash', 'status' => 'verified', 'paid_at' => now()]);
        $bill->recalculate();
        $this->assertTrue(app(PaymentArrangementService::class)->covers($bill->fresh()));
        $this->assertSame(60.0, $bill->fresh()->amountDue());
    }

    public function test_due_queue_uses_the_arrangement_and_ignores_fully_paid_installments(): void
    {
        extract($this->setupReturn(100));
        $bill->installments()->create(['label' => 'Original', 'sequence' => 1, 'amount' => 100, 'due_date' => '2026-08-01']);
        $this->actingAs($admin)->getJson('/api/admin/bills?tracking_state=due_now')->assertOk()->assertJsonCount(1, 'data');
        $this->putJson("/api/admin/bills/$bill->id/payment-arrangement", [
            'remarks' => 'Two installments', 'installments' => [['dueDate' => '2027-06-02', 'amount' => 40], ['dueDate' => '2027-06-20', 'amount' => 60]],
        ])->assertSuccessful();
        $this->getJson('/api/admin/bills?tracking_state=due_now')->assertOk()->assertJsonCount(0, 'data');
        $this->travelTo(Carbon::parse('2027-06-03', 'Asia/Manila'));
        $this->getJson('/api/admin/bills?tracking_state=due_now')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments", ['amount' => 40, 'method' => 'cash', 'paidAt' => '2027-06-03'])->assertSuccessful();
        $this->getJson('/api/admin/bills?tracking_state=due_now')->assertOk()->assertJsonCount(0, 'data');
        $bill->paymentArrangement()->delete();
        $bill->installments()->delete();
        $bill->installments()->create(['label' => 'Paid', 'sequence' => 1, 'amount' => 40, 'due_date' => '2027-06-01']);
        $bill->installments()->create(['label' => 'Future', 'sequence' => 2, 'amount' => 60, 'due_date' => '2027-06-20']);
        $this->getJson('/api/admin/bills?tracking_state=due_now')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_fully_settled_bill_meets_payment_requirement_after_benefits_reduce_the_downpayment(): void
    {
        extract($this->setupReturn(0));
        StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $bill->id, 'amount' => 100, 'issued_by' => $admin->id]);
        $response = $this->actingAs($admin)->postJson("/api/admin/students/$student->id/returning-enrollments", $this->payload($year))->assertSuccessful();
        $return = Enrollment::findOrFail($response->json('data.id'));
        $this->assertSame('pending', $return->status);
        $newBill = $return->bill;
        $newBill->adjustments()->create(['label' => 'New eligibility', 'type' => 'fixed', 'value' => 900, 'amount' => 900]);
        $newBill = $newBill->fresh();
        $newBill->recalculate();
        $newBill->settleEnrollment();
        $this->assertSame(0.0, $newBill->balance());
        $this->assertSame('enrolled', $return->fresh()->status);
    }

    public function test_historical_payment_is_owner_authorized_and_verification_is_idempotent(): void
    {
        extract($this->setupReturn());
        $other = $this->student();
        $data = ['amount' => 100, 'method' => 'gcash', 'proofKey' => 'proof.jpg', 'paidAt' => '2027-06-01'];
        $url = "/api/me/bills/$bill->id/payments";
        $this->actingAs($other->user)->postJson($url, $data)->assertNotFound();
        $this->actingAs($student->user)->postJson($url, $data)->assertSuccessful();
        $this->postJson($url, $data)->assertUnprocessable();
        $payment = $bill->payments()->firstOrFail();
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")->assertSuccessful();
        $this->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")->assertSuccessful();
        $this->assertEquals(100, $bill->fresh()->amount_paid);
        $this->assertSame(1, $bill->payments()->count());
    }

    public function test_credit_meets_return_payment_requirement_and_new_voucher_is_explicit(): void
    {
        extract($this->setupReturn(0));
        StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $bill->id, 'amount' => 250, 'issued_by' => $admin->id]);
        $url = "/api/admin/students/$student->id/returning-enrollments";
        $response = $this->actingAs($admin)->postJson($url, $this->payload($year))->assertSuccessful();
        $return = Enrollment::findOrFail($response->json('data.id'));
        $this->assertSame('enrolled', $return->status);
        $this->assertSame(250.0, $return->bill->creditApplied());
        $this->assertEquals(0, $return->bill->amount_paid);
        $this->assertSame(750.0, $return->bill->balance());
        $this->assertNull($return->discount_id);
        $this->postJson($url, $this->payload($year))->assertSuccessful();
        $this->assertSame(1, $return->bill->creditAllocations()->count());
    }

    public function test_same_year_return_and_implicit_voucher_classification_are_blocked(): void
    {
        extract($this->setupReturn());
        $payload = $this->payload($old->schoolYear);
        $url = "/api/admin/students/$student->id/returning-enrollments";
        $this->actingAs($admin)->postJson($url, $payload)->assertUnprocessable();
        $voucher = Discount::create(['name' => 'New voucher', 'category' => 'voucher', 'type' => 'fixed', 'value' => 100, 'is_active' => true]);
        $payload = [...$this->payload($year), 'discountId' => $voucher->id];
        $this->postJson($url, $payload)->assertUnprocessable();
        $payload['droppingCategory'] = 'voucher_esc';
        $response = $this->postJson($url, $payload)->assertSuccessful();
        $return = Enrollment::findOrFail($response->json('data.id'));
        $this->assertTrue($return->no_downpayment);
        $this->assertSame('pending', $return->status); // Voucher waiver cannot bypass old debt.
    }

    public function test_unknown_legacy_dates_never_hide_previous_debt_or_allow_activation(): void
    {
        extract($this->setupReturn(100));
        $old->schoolYear->update(['start_date' => null]);
        $response = $this->actingAs($admin)->postJson("/api/admin/students/$student->id/returning-enrollments", $this->payload($year))->assertSuccessful();
        $return = Enrollment::findOrFail($response->json('data.id'));
        $newBill = $return->bill;
        $this->actingAs($cashier)->postJson("/api/admin/bills/$newBill->id/payments", ['amount' => 200, 'method' => 'cash', 'paidAt' => '2027-06-01'])->assertSuccessful();
        $credits = app(StudentCreditService::class);
        $this->assertSame(100.0, $credits->previousBalance($return->fresh()));
        $this->assertFalse($return->fresh()->canActivate());
        $return->update(['returning_from_enrollment_id' => null]); // Other creation paths still enforce the same debt.
        $this->assertFalse($return->fresh()->canActivate());
        $bill->payments()->create(['amount' => 100, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
        $this->assertTrue($return->fresh()->canActivate());
        $year->update(['start_date' => null]);
        $this->assertFalse($return->fresh()->canActivate());
    }
}
