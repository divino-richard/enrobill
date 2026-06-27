<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\PaymentChannel;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashierOnlyPaymentAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_record_a_bill_payment(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $bill = $this->createBill();

        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/bills/{$bill->id}/payments", [
            'amount' => 500,
            'method' => 'cash',
            'paidAt' => '2026-06-27',
        ])->assertForbidden();
    }

    public function test_admin_cannot_update_payment_channels(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $channel = PaymentChannel::query()->firstOrFail();

        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/payment-channels/{$channel->id}", [
            'accountName' => 'Readonly Admin',
            'accountNumber' => '09170001122',
            'isActive' => true,
        ])->assertForbidden();
    }

    public function test_admin_cannot_generate_a_bill_from_enrollment(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $enrollment = $this->createEnrollment();

        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/enrollments/{$enrollment->id}/bill")
            ->assertForbidden();
    }

    public function test_cashier_can_update_payment_channels(): void
    {
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $channel = PaymentChannel::query()->firstOrFail();

        Sanctum::actingAs($cashier);

        $this->putJson("/api/admin/payment-channels/{$channel->id}", [
            'accountName' => 'Cashier Managed',
            'accountNumber' => '09170001122',
            'isActive' => false,
        ])->assertOk();

        $this->assertDatabaseHas('payment_channels', [
            'id' => $channel->id,
            'account_name' => 'Cashier Managed',
            'account_number' => '09170001122',
            'is_active' => false,
        ]);
    }

    private function createBill(): Bill
    {
        $enrollment = $this->createEnrollment();

        return Bill::create([
            'student_id' => $enrollment->student_id,
            'school_year_id' => $enrollment->school_year_id,
            'enrollment_id' => $enrollment->id,
            'total' => 1000,
            'amount_paid' => 0,
            'status' => 'unpaid',
        ]);
    }

    private function createEnrollment(): Enrollment
    {
        $studentUser = User::factory()->create(['role' => Role::Student]);

        $student = Student::create([
            'user_id' => $studentUser->id,
            'student_number' => '2026-TEST-001',
            'status' => 'admitted',
            'first_name' => 'Test',
            'last_name' => 'Student',
            'email' => 'student@example.test',
            'track_or_strand' => 'STEM',
            'year_level' => 'grade_11',
            'school_year' => '2026-2027',
        ]);

        $schoolYear = SchoolYear::create([
            'school_year' => '2026-2027',
            'current_semester' => 'first',
            'is_active' => true,
            'admission_open' => true,
            'downpayment_type' => 'fixed',
            'downpayment_value' => 1000,
            'installment_count' => 4,
        ]);

        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'school_year_id' => $schoolYear->id,
            'track' => 'STEM',
            'year_level' => 'grade_11',
            'no_downpayment' => false,
            'status' => 'pending',
        ]);

        return $enrollment;
    }
}
