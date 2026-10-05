<?php

namespace Tests\Feature;

use App\Models\Bill;
use App\Models\PaymentArrangement;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\StudentNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class InstallmentArrangementReminderTest extends TestCase
{
    use RefreshDatabase;

    public function test_reminders_follow_replacement_schedule_and_only_notify_unpaid_amounts_once(): void
    {
        $this->travelTo(Carbon::parse('2027-06-01 10:00:00', 'Asia/Manila'));
        $actor = User::factory()->create();
        $student = Student::create(['user_id' => $actor->id, 'student_number' => 'NOTICE-1', 'first_name' => 'Test', 'last_name' => 'Student', 'status' => 'dropped']);
        $year = SchoolYear::create(['school_year' => '2026-2027']);
        $bill = Bill::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'total' => 100, 'amount_paid' => 0, 'status' => 'unpaid']);
        $bill->installments()->create(['sequence' => 1, 'label' => 'Old installment', 'amount' => 100, 'due_date' => '2027-06-02']);
        $arrangement = PaymentArrangement::create(['bill_id' => $bill->id, 'approved_by' => $actor->id, 'starting_paid' => 0, 'remarks' => 'Approved', 'installments' => [['dueDate' => '2027-06-10', 'amount' => 40], ['dueDate' => '2027-06-20', 'amount' => 60]]]);
        $this->artisan('notifications:installments-due')->assertSuccessful();
        $this->assertDatabaseCount('student_notifications', 0);
        $this->travelTo(Carbon::parse('2027-06-08 10:00:00', 'Asia/Manila'));
        $bill->payments()->create(['amount' => 10, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
        $this->artisan('notifications:installments-due')->assertSuccessful();
        $this->artisan('notifications:installments-due')->assertSuccessful();
        $this->assertDatabaseCount('student_notifications', 1);
        $notice = StudentNotification::firstOrFail();
        $this->assertStringContainsString('₱30.00', $notice->message);
        $this->assertStringContainsString('Jun 10, 2027', $notice->message);
        $this->assertSame('/portal/bills/'.$bill->id, $notice->cta_url);
        $this->assertSame(40.0, (float) $arrangement->fresh()->installments[0]['amount']);
    }
}
