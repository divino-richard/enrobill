<?php

namespace Tests\Feature;

use App\Actions\EnsureEnrollment;
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
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CreatesLegacyReturningEnrollment;
use Tests\TestCase;

class DroppingReenrollmentRulesTest extends TestCase
{
    use CreatesLegacyReturningEnrollment;
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
        $year = SchoolYear::create(['fees_published_at' => now(), 'school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31', 'is_active' => true, 'downpayment_value' => 200, 'installment_count' => 4]);
        $old = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id, 'status' => 'dropped', 'track' => 'stem', 'year_level' => 'grade_11']);
        $drop = DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $old->id, 'status' => 'confirmed', 'effective_date' => $date, 'confirmed_at' => now(), 'snapshot' => [], 'submissions' => [], 'events' => []]);
        $bill = Bill::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id, 'enrollment_id' => $old->id, 'total' => 100, 'amount_paid' => 0, 'status' => 'unpaid']);
        $bill->installments()->create(['sequence' => 1, 'label' => 'Original installment', 'amount' => 100, 'due_date' => '2026-10-08']);
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        $year->fees()->create(['name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);

        return compact('student', 'user', 'admin', 'cashier', 'old', 'drop', 'bill', 'year');
    }

    private function startReturn(array $f): Enrollment
    {
        $response = $this->actingAs($f['admin'])->postJson("/api/admin/students/{$f['student']->id}/returning-enrollments", $this->payload($f['year']))->assertSuccessful();

        $return = Enrollment::findOrFail($response->json('data.id'));
        $this->actingAs($f['cashier'])->postJson("/api/admin/enrollments/$return->id/bill")->assertSuccessful();

        return $return->fresh();
    }

    private function payload(SchoolYear $year): array
    {
        return ['schoolYearId' => $year->id, 'program' => 'stem', 'yearLevel' => 'grade_11', 'discountId' => null];
    }

    public function test_existing_drop_has_no_due_schedule_or_actionable_reminder_and_accepts_voluntary_partial_payment(): void
    {
        extract($this->fixture());
        $original = $bill->installments()->get()->toArray();
        $notice = StudentNotification::create(['student_id' => $student->id, 'category' => 'billing', 'title' => 'Installment due soon', 'message' => 'Old reminder', 'cta_url' => "/portal/bills/$bill->id", 'action_required' => true, 'dedupe_key' => 'installment-due:'.$bill->installments()->first()->id]);
        $this->actingAs($user)->getJson('/api/me/bills')->assertOk()->assertJsonPath('data.0.collectionState', 'deferred_until_reenrollment')->assertJsonPath('data.0.amountDue', 0)->assertJsonCount(0, 'data.0.installments');
        $this->getJson('/api/me/notifications')->assertOk()->assertJsonPath('data.0.actionRequired', false);
        $this->assertDatabaseHas('student_notifications', ['id' => $notice->id, 'message' => 'Old reminder']);
        $this->postJson("/api/me/bills/$bill->id/payments", ['amount' => 10, 'method' => 'gcash', 'proofKey' => 'proof.jpg', 'reference' => 'GC-001234', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $this->assertSame(100.0, $bill->fresh()->balance());
        $payment = $bill->payments()->first();
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")->assertSuccessful();
        $this->assertSame(90.0, $bill->fresh()->balance());
        $this->assertEquals($original, $bill->installments()->get()->toArray());
        $this->getJson('/api/admin/bills?tracking_state=due_now')->assertOk()->assertJsonCount(0, 'data');
        $this->travelTo(Carbon::parse('2026-10-07', 'Asia/Manila'));
        $this->artisan('notifications:installments-due')->assertSuccessful();
        $this->assertSame(1, $student->notifications()->where('dedupe_key', 'like', 'installment-due:%')->count());
    }

    public function test_return_requires_full_verified_settlement_and_new_downpayment_even_with_historical_arrangement(): void
    {
        $f = $this->fixture();
        extract($f);
        PaymentArrangement::create(['bill_id' => $bill->id, 'approved_by' => $admin->id, 'remarks' => 'Historical', 'starting_paid' => 0, 'installments' => [['dueDate' => '2028-01-01', 'amount' => 100]]]);
        $return = $this->legacyReturn($student, $year, $old);
        $newBill = $return->bill;
        $this->actingAs($admin)->getJson("/api/admin/bills/$bill->id")->assertOk()->assertJsonPath('data.collectionState', 'required_for_reenrollment')->assertJsonPath('data.amountDue', 100)->assertJsonCount(0, 'data.installments');
        $this->actingAs($cashier)->postJson("/api/admin/bills/$newBill->id/payments", ['amount' => 200, 'method' => 'cash', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $this->assertSame('pending', $return->fresh()->status);
        $this->putJson("/api/admin/bills/$bill->id/payment-arrangement", ['remarks' => 'Bypass', 'installments' => [['dueDate' => '2028-01-01', 'amount' => 100]]])->assertUnprocessable();
        $this->actingAs($user)->postJson("/api/me/bills/$bill->id/payments", ['amount' => 40, 'method' => 'gcash', 'proofKey' => 'proof.jpg', 'reference' => 'GC-001234', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $payment = $bill->payments()->first();
        $this->assertSame('pending', $return->fresh()->status);
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")->assertSuccessful();
        $this->assertSame('pending', $return->fresh()->status);
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments", ['amount' => 60, 'method' => 'cash', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $this->assertSame('enrolled', $return->fresh()->status);
        $this->assertSame('dropped', $old->fresh()->status);
        $this->assertSame('Historical', $bill->paymentArrangement->remarks);
    }

    public static function deadlines(): array
    {
        return [
            ['2026-10-07', '2028-10-07 15:59:59 UTC', '2028-10-07', true],
            ['2026-10-07', '2028-10-07 16:00:00 UTC', '2028-10-07', false],
            ['2024-02-29', '2026-02-28 23:59:59 Asia/Manila', '2026-02-28', true],
            ['2024-02-29', '2026-03-01 00:00:00 Asia/Manila', '2026-02-28', false],
        ];
    }

    #[DataProvider('deadlines')]
    public function test_return_deadline_uses_effective_date_calendar_years_and_manila_day(string $date, string $now, string $deadline, bool $allowed): void
    {
        extract($this->fixture($date));
        $bill->payments()->create(['amount' => 100, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
        $this->travelTo(Carbon::parse($now));
        $this->actingAs($admin)->getJson("/api/admin/students/$student->id/returning-summary")->assertOk()->assertJsonPath('data.returnDeadline', $deadline)->assertJsonPath('data.eligible', $allowed);
        $response = $this->postJson("/api/admin/students/$student->id/returning-enrollments", $this->payload($year));
        $allowed ? $response->assertSuccessful() : $response->assertUnprocessable();
    }

    public function test_expiry_during_verification_cannot_be_bypassed_by_a_backdated_payment_or_alternate_activation(): void
    {
        $f = $this->fixture();
        extract($f);
        $return = $this->legacyReturn($student, $year, $old);
        $return->bill->payments()->create(['amount' => 200, 'method' => 'cash', 'status' => 'verified', 'paid_at' => now()]);
        $return->bill->recalculate();
        $payment = $bill->payments()->create(['amount' => 100, 'method' => 'gcash', 'status' => 'pending', 'paid_at' => '2028-10-07']);
        $return->update(['returning_from_enrollment_id' => null]);
        $this->travelTo(Carbon::parse('2028-10-08', 'Asia/Manila'));
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments/$payment->id/verify")->assertSuccessful();
        $this->assertSame('pending', $return->fresh()->status);
        $this->actingAs($admin)->putJson("/api/admin/enrollments/$return->id", ['status' => 'enrolled'])->assertUnprocessable();
        $this->assertSame(0.0, $bill->fresh()->balance());
    }

    public function test_alternative_creation_cannot_start_an_expired_return(): void
    {
        extract($this->fixture());
        $this->travelTo(Carbon::parse('2028-10-08', 'Asia/Manila'));
        $this->expectException(ValidationException::class);
        app(EnsureEnrollment::class)($student, $year);
    }

    public function test_activation_on_anniversary_and_alternative_path_still_requires_full_debt(): void
    {
        extract($this->fixture());
        $return = $this->legacyReturn($student, $year, $old);
        $return->update(['returning_from_enrollment_id' => null]);
        $newBill = $return->bill;
        $newBill->payments()->create(['amount' => 1000, 'method' => 'cash', 'status' => 'verified', 'paid_at' => now()]);
        $newBill->recalculate();
        $newBill->settleEnrollment();
        $this->assertSame('pending', $return->fresh()->status);
        $this->actingAs($admin)->putJson("/api/admin/students/$student->id", ['firstName' => 'Deferred', 'lastName' => 'Student', 'status' => 'enrolled'])->assertUnprocessable();
        $this->travelTo(Carbon::parse('2028-10-07 23:59:59', 'Asia/Manila'));
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments", ['amount' => 100, 'method' => 'cash', 'paidAt' => '2028-10-07'])->assertSuccessful();
        $this->assertSame('enrolled', $return->fresh()->status);
    }

    public function test_unactivated_withdrawn_return_does_not_close_the_original_window(): void
    {
        $f = $this->fixture();
        extract($f);
        $return = $this->legacyReturn($student, $year, $old);
        $this->actingAs($admin)->putJson("/api/admin/enrollments/$return->id", ['status' => 'withdrawn'])->assertSuccessful();
        $this->travelTo(Carbon::parse('2028-10-08', 'Asia/Manila'));
        $later = SchoolYear::create(['school_year' => '2028-2029', 'start_date' => '2028-06-01', 'end_date' => '2029-03-31']);
        $this->expectException(ValidationException::class);
        app(EnsureEnrollment::class)($student, $later);
    }

    public function test_legacy_approved_bill_without_assessment_cannot_be_voided_or_discounted(): void
    {
        extract($this->fixture());
        $voucher = Discount::create(['name' => 'New discount', 'category' => 'voucher', 'type' => 'fixed', 'value' => 50, 'is_active' => true]);
        $this->actingAs($admin)->deleteJson("/api/admin/bills/$bill->id")->assertUnprocessable();
        $this->postJson("/api/admin/bills/$bill->id/adjustments", ['discountId' => $voucher->id])->assertUnprocessable();
        $this->assertSame(100.0, $bill->fresh()->balance());
        $this->assertEquals(100, $bill->installments()->sum('amount'));
    }

    public function test_missing_confirmed_dropping_date_blocks_return_even_when_debt_is_paid(): void
    {
        extract($this->fixture(null));
        $bill->update(['amount_paid' => 100]);
        $this->actingAs($admin)->getJson("/api/admin/students/$student->id/returning-summary")->assertOk()->assertJsonPath('data.eligible', false)->assertJsonPath('data.returnDeadline', null);
        $this->postJson("/api/admin/students/$student->id/returning-enrollments", $this->payload($year))->assertUnprocessable();
    }

    public function test_completed_return_is_not_revoked_and_later_normal_enrollment_has_no_old_deadline(): void
    {
        $f = $this->fixture();
        extract($f);
        $bill->payments()->create(['amount' => 100, 'method' => 'cash', 'status' => 'verified', 'paid_at' => now()]);
        $bill->recalculate();
        $return = $this->startReturn($f);
        $this->assertSame(100.0, $return->bill->creditApplied());
        $this->actingAs($cashier)->postJson("/api/admin/bills/{$return->bill->id}/payments", ['amount' => 900, 'method' => 'cash', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $this->travelTo(Carbon::parse('2029-06-01', 'Asia/Manila'));
        $this->assertSame('enrolled', $return->fresh()->status);
        $laterYear = SchoolYear::create(['fees_published_at' => now(), 'school_year' => '2029-2030', 'start_date' => '2029-06-01', 'end_date' => '2030-03-31']);
        $later = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $laterYear->id, 'status' => 'pending', 'track' => 'stem', 'year_level' => 'grade_12']);
        Bill::create(['student_id' => $student->id, 'school_year_id' => $laterYear->id, 'enrollment_id' => $later->id, 'total' => 0, 'amount_paid' => 0, 'status' => 'paid']);
        $this->assertTrue($later->canActivate());
    }
}
