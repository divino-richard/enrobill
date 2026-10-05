<?php

namespace Tests\Feature;

use App\Actions\NotifyStudent;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\Discount;
use App\Models\DroppingPolicy;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class DroppingApprovalFinanceTest extends TestCase
{
    use RefreshDatabase;

    private function requestWithBill(int $paid = 0): array
    {
        $this->travelTo(Carbon::parse('2026-09-30 12:00:00', 'Asia/Manila'));
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'FIN-'.$user->id,
            'status' => 'enrolled', 'first_name' => 'Finance', 'last_name' => 'Student']);
        $year = SchoolYear::firstOrCreate(['school_year' => '2026-2027'], ['start_date' => '2026-06-01', 'end_date' => '2027-03-31', 'is_active' => true]);
        $e = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id,
            'track' => 'stem', 'year_level' => 'grade_11', 'status' => 'enrolled', 'dropping_category' => 'paying', 'enrolled_at' => '2026-05-01']);
        $bill = Bill::create(['student_id' => $student->id, 'enrollment_id' => $e->id, 'school_year_id' => $year->id,
            'total' => 11000, 'amount_paid' => $paid, 'status' => $paid ? 'partial' : 'unpaid']);
        foreach (['registration' => 1000, 'miscellaneous' => 2000, 'laboratory' => 1000, 'tuition' => 6000, 'other' => 1000] as $component => $amount) {
            $bill->items()->create(['name' => ucfirst($component), 'category' => 'other', 'dropping_component' => $component, 'amount' => $amount]);
        }
        $bill->installments()->create(['label' => 'Downpayment', 'sequence' => 0, 'amount' => 2000, 'due_date' => '2026-05-01']);
        $bill->installments()->create(['label' => 'Remaining', 'sequence' => 1, 'amount' => 9000, 'due_date' => '2026-10-15']);
        if ($paid) {
            $bill->payments()->create(['amount' => $paid, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        }
        $drop = DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $e->id, 'active_enrollment_id' => $e->id,
            'status' => 'submitted', 'snapshot' => ['studentName' => 'Finance Student', 'studentNumber' => $student->student_number, 'schoolYear' => $year->school_year, 'program' => 'stem', 'yearLevel' => 'grade_11'],
            'submissions' => [['version' => 1, 'submittedAt' => now()->toIso8601String(), 'reason' => 'Moving', 'files' => []]], 'events' => []]);
        DroppingPolicy::firstOrCreate(['school_year_id' => $year->id, 'version' => 1], ['enabled' => true, 'periods' => DroppingPolicyConfigurationTest::periods()]);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));

        return [$drop, $bill, $e];
    }

    private function preview(DroppingRequest $drop): array
    {
        return $this->getJson("/api/dropping-requests/{$drop->id}/assessment?effectiveDate=2026-09-30")->assertOk()->json('data');
    }

    private function approve(DroppingRequest $drop, array $preview)
    {
        return $this->postJson("/api/admin/dropping-requests/{$drop->id}/confirm", ['version' => 1, 'effectiveDate' => '2026-09-30', 'assessmentFingerprint' => $preview['fingerprint']]);
    }

    public function test_changed_payments_block_stale_approval_and_duplicate_approval_issues_credit_once(): void
    {
        [$drop, $bill, $e] = $this->requestWithBill(7000);
        $preview = $this->preview($drop);
        $this->assertTrue($preview['ready']);
        $this->assertEquals(6000, $preview['finalCharge']);
        $bill->payments()->create(['amount' => 100, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $this->approve($drop, $preview)->assertConflict();
        $this->assertSame('enrolled', $e->fresh()->status);
        $this->assertDatabaseCount('dropping_assessments', 0);
        $this->approve($drop, $this->preview($drop))->assertOk()->assertJsonPath('data.droppingAssessment.finalCharge', 6000);
        $this->approve($drop, $preview)->assertOk();
        $this->assertDatabaseCount('student_credits', 1);
        $this->assertDatabaseHas('student_credits', ['source_bill_id' => $bill->id, 'amount' => 1100]);
        $this->assertDatabaseCount('dropping_assessments', 1);
        $this->assertEquals(7100, $bill->fresh()->amount_paid);
        $this->assertEquals(0, $bill->fresh()->balance());
        $this->getJson('/api/admin/dashboard')->assertOk()->assertJsonPath('data.finance.billed', 6000)->assertJsonPath('data.finance.collected', 7100);
        $this->getJson('/api/admin/reports')->assertOk()->assertJsonPath('data.summary.totalBilled', 6000)->assertJsonPath('data.summary.totalCollected', 7100);
    }

    public function test_pending_payments_and_unclassified_fees_block_approval_until_resolved(): void
    {
        [$drop, $bill, $e] = $this->requestWithBill();
        $item = $bill->items()->first();
        $item->update(['dropping_component' => null]);
        $e->update(['dropping_category' => null]);
        $payment = $bill->payments()->create(['amount' => 100, 'status' => 'pending', 'method' => 'gcash', 'paid_at' => now()]);
        $preview = $this->preview($drop);
        $this->assertFalse($preview['ready']);
        $this->approve($drop, $preview)->assertUnprocessable();
        $this->putJson("/api/admin/bills/{$bill->id}/dropping-classification", ['items' => [['id' => $item->id, 'component' => 'registration']]])->assertOk();
        $this->putJson("/api/admin/enrollments/{$e->id}/dropping-category", ['category' => 'voucher_esc'])->assertOk();
        $payment->update(['status' => 'rejected']);
        $preview = $this->preview($drop);
        $this->assertTrue($preview['ready']);
        $this->assertEquals(2000, $preview['finalCharge']);
        $this->approve($drop, $preview)->assertOk();
        $this->putJson("/api/admin/bills/{$bill->id}/dropping-classification", ['items' => [['id' => $item->id, 'component' => 'other']]])->assertUnprocessable();
        $this->putJson("/api/admin/enrollments/{$e->id}/dropping-category", ['category' => 'paying'])->assertUnprocessable();
    }

    public function test_preview_is_owner_authorized_and_final_snapshot_survives_policy_changes(): void
    {
        [$drop, $bill, $e] = $this->requestWithBill();
        $admin = auth()->user();
        $this->actingAs(User::factory()->create(['role' => Role::Student]));
        $this->getJson("/api/dropping-requests/{$drop->id}/assessment?effectiveDate=2026-09-30")->assertNotFound();
        $this->actingAs($e->student->user);
        $this->assertTrue($this->preview($drop)['ready']);
        $this->actingAs($admin);
        $preview = $this->preview($drop);
        $this->putJson("/api/admin/school-years/{$e->school_year_id}/dropping-policy", ['enabled' => false, 'periods' => DroppingPolicyConfigurationTest::periods()])->assertOk();
        $this->approve($drop, $preview)->assertUnprocessable();
        $this->putJson("/api/admin/school-years/{$e->school_year_id}/dropping-policy", ['enabled' => true, 'periods' => DroppingPolicyConfigurationTest::periods()])->assertOk();
        $this->approve($drop, $this->preview($drop))->assertOk();
        $this->putJson("/api/admin/school-years/{$e->school_year_id}/dropping-policy", ['enabled' => false, 'periods' => DroppingPolicyConfigurationTest::periods()])->assertOk();
        $this->assertEquals(6000, $this->preview($drop)['finalCharge']);
        $this->assertEquals(3, $this->preview($drop)['policyVersion']);
        $this->assertEquals(6000, $bill->fresh()->netTotal());
    }

    public function test_final_assessment_preserves_benefits_and_prevents_destructive_financial_edits(): void
    {
        [$drop, $bill, $e] = $this->requestWithBill(7000);
        $voucher = Discount::create(['name' => 'Original voucher', 'category' => 'voucher', 'type' => 'fixed', 'value' => 11000, 'is_active' => true]);
        $adjustment = $bill->adjustments()->create(['discount_id' => $voucher->id, 'label' => $voucher->name, 'type' => 'fixed', 'value' => 11000, 'amount' => 11000]);
        $this->approve($drop, $this->preview($drop))->assertOk();
        $this->assertEquals(6000, $bill->fresh()->netTotal());
        $this->deleteJson("/api/admin/bills/{$bill->id}/adjustments/{$adjustment->id}")->assertUnprocessable();
        $this->deleteJson("/api/admin/bills/{$bill->id}")->assertUnprocessable();
        $this->deleteJson("/api/admin/discounts/{$voucher->id}")->assertUnprocessable();
        $this->assertDatabaseHas('bill_adjustments', ['id' => $adjustment->id, 'amount' => 11000]);
        $this->actingAs(User::factory()->create(['role' => Role::Cashier]));
        $payment = $bill->payments()->first();
        $this->deleteJson("/api/admin/bills/{$bill->id}/payments/{$payment->id}")->assertUnprocessable();
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'verified']);
        $this->assertDatabaseHas('student_credits', ['source_bill_id' => $bill->id, 'amount' => 1000]);
    }

    public function test_failed_finalization_rolls_back_assessment_credit_and_enrollment_together(): void
    {
        [$drop, $bill, $enrollment] = $this->requestWithBill(7000);
        $preview = $this->preview($drop);
        // Fail after the financial posting, before the approval transaction ends.
        $this->mock(NotifyStudent::class, fn ($mock) => $mock->shouldReceive('__invoke')->andThrow(new \RuntimeException('Simulated notification failure')));
        $this->approve($drop, $preview)->assertStatus(500);
        $this->assertDatabaseCount('dropping_assessments', 0);
        $this->assertDatabaseCount('student_credits', 0);
        $this->assertSame('submitted', $drop->fresh()->status);
        $this->assertSame('enrolled', $enrollment->fresh()->status);
        $this->assertSame(11000.0, $bill->fresh()->netTotal());
    }

    public function test_legacy_approval_is_not_reassessed_and_current_payments_do_not_rewrite_approval_snapshot(): void
    {
        [$legacy, $oldBill] = $this->requestWithBill();
        $legacy->update(['status' => 'confirmed', 'active_enrollment_id' => null]);
        $preview = $this->preview($legacy);
        $this->assertTrue($preview['legacy']);
        $this->assertFalse($preview['ready']);
        $this->assertNull($preview['finalCharge']);
        $this->assertSame(11000.0, $oldBill->fresh()->netTotal());
        $this->assertDatabaseCount('dropping_assessments', 0);

        [$drop, $bill] = $this->requestWithBill();
        $this->approve($drop, $this->preview($drop))->assertOk();
        $this->actingAs(User::factory()->create(['role' => Role::Cashier]));
        $this->postJson("/api/admin/bills/$bill->id/payments", ['amount' => 100, 'method' => 'cash', 'paidAt' => '2026-09-30'])->assertOk();
        $this->actingAs($drop->student->user)->getJson("/api/dropping-requests/$drop->id")->assertOk()
            ->assertJsonPath('data.financialSummary.verifiedPayments', 100)
            ->assertJsonPath('data.financialSummary.balance', 5900)
            ->assertJsonPath('data.droppingAssessment.verifiedPayments', 0)
            ->assertJsonPath('data.droppingAssessment.balance', 6000);
    }
}
