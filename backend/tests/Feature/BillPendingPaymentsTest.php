<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Bill;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BillPendingPaymentsTest extends TestCase
{
    use RefreshDatabase;

    private function bill(SchoolYear $year, array $paymentStatuses = [], string $status = 'unpaid', string $lastName = 'Student'): Bill
    {
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create([
            'user_id' => $user->id,
            'student_number' => 'BILL-'.$user->id,
            'first_name' => 'Billing',
            'last_name' => $lastName,
            'status' => 'enrolled',
        ]);
        $bill = Bill::create([
            'student_id' => $student->id,
            'school_year_id' => $year->id,
            'total' => 1000,
            'amount_paid' => $status === 'partial' ? 100 : 0,
            'status' => $status,
        ]);
        foreach ($paymentStatuses as $paymentStatus) {
            $bill->payments()->create(['amount' => 100, 'method' => 'gcash', 'status' => $paymentStatus, 'paid_at' => '2026-10-17']);
        }

        return $bill;
    }

    public function test_listing_counts_only_pending_payments_and_refreshes_when_they_are_resolved(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $pending = $this->bill($year, ['pending', 'pending', 'verified', 'rejected']);
        $resolved = $this->bill($year, ['verified', 'rejected']);
        $empty = $this->bill($year);
        $this->actingAs(User::factory()->create(['role' => Role::Cashier]));

        $rows = collect($this->getJson('/api/admin/bills')->assertOk()->json('data'))->keyBy('id');
        $this->assertSame(2, $rows[$pending->id]['pendingPaymentCount']);
        $this->assertSame(0, $rows[$resolved->id]['pendingPaymentCount']);
        $this->assertSame(0, $rows[$empty->id]['pendingPaymentCount']);

        $payments = $pending->payments()->where('status', 'pending')->get();
        $payments[0]->update(['status' => 'verified']);
        $payments[1]->update(['status' => 'rejected']);

        $rows = collect($this->getJson('/api/admin/bills')->assertOk()->json('data'))->keyBy('id');
        $this->assertSame(0, $rows[$pending->id]['pendingPaymentCount']);
        $this->getJson('/api/admin/bills?tracking_state=pending_payment')
            ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
    }

    public function test_pending_filter_applies_before_pagination_and_combines_with_other_filters(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $otherYear = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31']);
        $target = $this->bill($year, ['pending'], 'partial', 'Review');
        $this->bill($year, ['pending']);
        $this->bill($otherYear, ['pending'], 'partial', 'Review');
        $this->bill($year, ['verified', 'rejected']);
        $this->bill($year);
        $this->actingAs(User::factory()->create(['role' => Role::Cashier]));

        $this->getJson('/api/admin/bills?tracking_state=pending_payment&per_page=1&page=2')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 3)
            ->assertJsonPath('data.0.pendingPaymentCount', 1);
        $this->getJson('/api/admin/bills?'.http_build_query([
            'tracking_state' => 'pending_payment',
            'school_year_id' => $year->id,
            'status' => 'partial',
            'search' => 'Review',
        ]))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $target->id)->assertJsonPath('data.0.pendingPaymentCount', 1);
    }

    public function test_payment_decisions_keep_student_context_and_refresh_the_verification_queue(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $bill = $this->bill($year, ['pending', 'pending']);
        $payments = $bill->payments()->get();
        $this->actingAs(User::factory()->create(['role' => Role::Cashier]));

        $this->postJson("/api/admin/bills/{$bill->id}/payments/{$payments[0]->id}/verify")
            ->assertOk()->assertJsonPath('data.student.name', 'Billing Student')
            ->assertJsonPath('data.amountPaid', 100)->assertJsonPath('data.balance', 900);
        $this->getJson('/api/admin/bills?tracking_state=pending_payment')
            ->assertOk()->assertJsonPath('data.0.pendingPaymentCount', 1);
        $this->postJson("/api/admin/bills/{$bill->id}/payments/{$payments[1]->id}/reject")
            ->assertOk()->assertJsonPath('data.student.id', $bill->student_id)->assertJsonPath('data.balance', 900);
        $this->getJson('/api/admin/bills?tracking_state=pending_payment')->assertOk()->assertJsonCount(0, 'data');
        foreach ($payments as $payment) {
            $this->deleteJson("/api/admin/bills/{$bill->id}/payments/{$payment->id}")->assertNotFound();
        }
        $this->assertDatabaseHas('payments', ['id' => $payments[0]->id, 'status' => 'verified']);
        $this->assertDatabaseHas('payments', ['id' => $payments[1]->id, 'status' => 'rejected']);
        $this->assertSame(900.0, $bill->fresh()->balance());
        $this->postJson("/api/admin/bills/{$bill->id}/payments", ['amount' => 200, 'method' => 'cash', 'paidAt' => '2026-10-17'])
            ->assertOk()->assertJsonPath('data.student.id', $bill->student_id)->assertJsonPath('data.balance', 700);
    }
}
