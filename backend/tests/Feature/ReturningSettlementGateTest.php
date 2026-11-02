<?php

namespace Tests\Feature;

use App\Actions\EnsureEnrollment;
use App\Actions\GenerateBillForEnrollment;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\Discount;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\PaymentArrangement;
use App\Models\Program;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\StudentNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ReturningSettlementGateTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(?string $date = '2026-10-07'): array
    {
        $this->travelTo(Carbon::parse('2027-10-07 10:00:00', 'Asia/Manila'));
        Storage::fake('s3')->buildTemporaryUrlsUsing(fn () => 'https://example.test/proof');
        $user = User::factory()->create(['role' => Role::Student]);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'DEF-'.$user->id, 'first_name' => 'Deferred', 'last_name' => 'Student', 'status' => 'dropped', 'track_or_strand' => 'stem', 'year_level' => 'grade_11']);
        $oldYear = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $year = SchoolYear::create(['fees_published_at' => now(), 'school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31', 'is_active' => true, 'admission_open' => true, 'downpayment_value' => 200, 'installment_count' => 4]);
        $old = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id, 'status' => 'dropped', 'track' => 'stem', 'year_level' => 'grade_11']);
        $drop = DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $old->id, 'status' => 'confirmed', 'effective_date' => $date, 'confirmed_at' => now(), 'snapshot' => [], 'submissions' => [], 'events' => []]);
        $bill = Bill::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id, 'enrollment_id' => $old->id, 'total' => 100, 'amount_paid' => 0, 'status' => 'unpaid']);
        $bill->installments()->create(['sequence' => 1, 'label' => 'Original installment', 'amount' => 100, 'due_date' => '2026-10-08']);
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        $year->fees()->create(['name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);

        return compact('student', 'user', 'admin', 'cashier', 'old', 'drop', 'bill', 'year');
    }


    public function test_unpaid_partial_and_unverified_balances_block_student_and_staff_creation(): void
    {
        extract($this->fixture());
        $payload = ['schoolYearId' => $year->id, 'program' => 'stem', 'yearLevel' => 'grade_11', 'discountId' => null];
        foreach ([0, 40] as $paid) {
            if ($paid) {
                $bill->payments()->create(['amount' => $paid, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
                $bill->recalculate();
            }
            $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()
                ->assertJsonPath('data.state', 'settlement_required')->assertJsonPath('data.canStart', false);
            $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
            $this->actingAs($admin)->getJson("/api/admin/students/$student->id/returning-summary")->assertOk()->assertJsonPath('data.eligible', false);
            $this->postJson("/api/admin/students/$student->id/returning-enrollments", $payload)->assertUnprocessable();
        }
        $bill->payments()->create(['amount' => 60, 'status' => 'pending', 'method' => 'gcash', 'paid_at' => now()]);
        $bill->recalculate();
        $this->actingAs($user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
        $this->assertSame(1, $student->enrollments()->count());
        $this->assertSame(1, $student->bills()->count());
        $this->assertSame('dropped', $student->fresh()->status);
    }

    public function test_verified_settlement_allows_pending_return_but_only_cashier_generates_bill(): void
    {
        extract($this->fixture());
        $payment = $bill->payments()->create(['amount' => 100, 'status' => 'pending', 'method' => 'gcash', 'paid_at' => now()]);
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")->assertSuccessful();
        $this->assertSame(1, $student->enrollments()->count()); // Payment alone never starts a return.
        $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.canStart', true);
        $response = $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful()->assertJsonPath('data.status', 'pending');
        $id = $response->json('data.id');
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful()->assertJsonPath('data.id', $id);
        $this->assertSame(1, $student->bills()->count());
        $this->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.enrollment.billId', null);
        $this->postJson("/api/admin/enrollments/$id/bill")->assertForbidden();
        $this->actingAs($admin)->postJson("/api/admin/enrollments/$id/bill")->assertForbidden();
        $response = $this->actingAs($cashier)->postJson("/api/admin/enrollments/$id/bill")->assertSuccessful();
        $newBill = $response->json('data.id');
        $this->postJson("/api/admin/enrollments/$id/bill")->assertSuccessful()->assertJsonPath('data.id', $newBill);
        $this->assertSame('pending', Enrollment::findOrFail($id)->status);
        $this->postJson("/api/admin/bills/$newBill/payments", ['amount' => 200, 'method' => 'cash', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $this->assertSame('enrolled', Enrollment::findOrFail($id)->status);
        $this->assertSame(2, $student->bills()->count());
    }

    public function test_staff_return_with_voucher_stays_pending_until_cashier_generation(): void
    {
        extract($this->fixture());
        $bill->payments()->create(['amount' => 100, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
        $voucher = Discount::create(['name' => 'Voucher', 'category' => 'voucher', 'type' => 'fixed', 'value' => 100, 'is_active' => true]);
        $response = $this->actingAs($admin)->postJson("/api/admin/students/$student->id/returning-enrollments", ['schoolYearId' => $year->id, 'program' => 'stem', 'yearLevel' => 'grade_11', 'discountId' => $voucher->id])->assertSuccessful()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.hasBill', false);
        $id = $response->json('data.id');
        $this->assertSame(1, $student->bills()->count());
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$id/bill")->assertSuccessful();
        $this->assertSame('enrolled', Enrollment::findOrFail($id)->status);
    }

    public function test_alternative_creation_cannot_bypass_previous_debt(): void
    {
        extract($this->fixture());
        $this->expectException(ValidationException::class);
        app(EnsureEnrollment::class)($student, $year);
    }

    public function test_legacy_pending_return_cannot_generate_a_new_bill_before_settlement(): void
    {
        extract($this->fixture());
        $return = Enrollment::withoutEvents(fn () => Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'status' => 'pending', 'track' => 'stem', 'year_level' => 'grade_11']));
        $this->actingAs($cashier)->postJson("/api/admin/enrollments/$return->id/bill")->assertUnprocessable();
        $this->assertSame(1, $student->bills()->count());
        $this->assertSame('pending', $return->fresh()->status);
        $rules = app(\App\Services\ReturningEnrollmentRules::class);
        $this->assertSame([
            'Settle the previous dropping balance first. Only verified payments and applied credits count.',
        ], $rules->requirements($return)['blockers']);
        $bill->payments()->create(['amount' => 100, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
        $this->assertSame([
            'Generate the new school year’s bill to determine its enrollment payment requirement.',
        ], $rules->requirements($return->fresh())['blockers']);
    }
    public function test_reopening_an_unactivated_attempt_cannot_bypass_settlement(): void
    {
        extract($this->fixture());
        $return = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'status' => 'withdrawn', 'track' => 'stem', 'year_level' => 'grade_11']);
        $this->actingAs($admin)->putJson("/api/admin/enrollments/$return->id", ['status' => 'pending'])->assertUnprocessable();
        $this->assertSame('withdrawn', $return->fresh()->status);
    }

    public function test_unallocated_credit_and_payment_arrangements_do_not_bypass_settlement(): void
    {
        extract($this->fixture());
        \App\Models\StudentCredit::create(['student_id' => $student->id, 'source_bill_id' => $bill->id, 'amount' => 500, 'issued_by' => $admin->id]);
        PaymentArrangement::create(['bill_id' => $bill->id, 'approved_by' => $admin->id, 'remarks' => 'Historical', 'starting_paid' => 0, 'installments' => [['dueDate' => '2028-01-01', 'amount' => 100]]]);
        $this->actingAs($user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
        $this->assertSame(1, $student->enrollments()->count());
    }
}
