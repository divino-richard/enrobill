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

class StudentReturningEnrollmentTest extends TestCase
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
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31', 'is_active' => true, 'admission_open' => true, 'downpayment_type' => 'fixed', 'downpayment_value' => 200, 'installment_count' => 4]);
        $old = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id, 'status' => 'dropped', 'track' => 'stem', 'year_level' => 'grade_11']);
        $drop = DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $old->id, 'status' => 'confirmed', 'effective_date' => $date, 'confirmed_at' => now(), 'snapshot' => [], 'submissions' => [], 'events' => []]);
        $bill = Bill::create(['student_id' => $student->id, 'school_year_id' => $oldYear->id, 'enrollment_id' => $old->id, 'total' => 100, 'amount_paid' => 0, 'status' => 'unpaid']);
        $bill->installments()->create(['sequence' => 1, 'label' => 'Original installment', 'amount' => 100, 'due_date' => '2026-10-08']);
        Program::firstOrCreate(['code' => 'stem'], ['name' => 'STEM', 'category' => 'academic', 'is_active' => true]);
        $year->fees()->create(['name' => 'Tuition', 'amount' => 1000, 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all']);

        return compact('student', 'user', 'admin', 'cashier', 'old', 'drop', 'bill', 'year');
    }


    public function test_student_sees_own_return_offer_and_cannot_select_another_student_or_voucher(): void
    {
        extract($this->fixture());
        $other = User::factory()->create(['role' => Role::Student]);
        $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()
            ->assertJsonPath('data.state', 'ready')->assertJsonPath('data.returnDeadline', '2028-10-07')
            ->assertJsonPath('data.offer.schoolYearId', $year->id)->assertJsonPath('data.offer.feeTotal', 1000)
            ->assertJsonPath('data.source.program', 'stem')->assertJsonPath('data.previousBills.0.balance', 100);
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id, 'studentId' => 99, 'discountId' => 1, 'status' => 'enrolled', 'yearLevel' => 'grade_12'])->assertUnprocessable();
        $this->assertSame(1, $student->enrollments()->count());
        $this->actingAs($other)->getJson('/api/me/re-enrollment')->assertNotFound();
        $this->actingAs($admin)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertForbidden();
    }

    public function test_no_open_later_year_explains_unavailability_and_blocks_creation(): void
    {
        extract($this->fixture());
        foreach ([['admission_open' => false], ['admission_open' => true, 'is_active' => false]] as $attributes) {
            $year->update($attributes);
            $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'unavailable')->assertJsonPath('data.offer', null);
            $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
        }
        $year->update(['is_active' => true, 'admission_open' => true]);
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $old->school_year_id])->assertUnprocessable();
        $year->fees()->delete();
        $this->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'unavailable');
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
        $this->assertSame(1, $student->enrollments()->count());
    }

    public function test_student_return_is_idempotent_and_waits_for_verified_old_and_new_payments(): void
    {
        extract($this->fixture());
        $this->actingAs($user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful()->assertJsonPath('data.status', 'pending');
        $return = $student->enrollments()->where('school_year_id', $year->id)->firstOrFail();
        $this->assertNull($return->discount_id);
        $this->assertSame('grade_11', $return->year_level);
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful()->assertJsonPath('data.id', $return->id);
        $this->assertSame(2, $student->enrollments()->count());
        $this->assertSame(2, $student->bills()->count());
        $this->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'pending')
            ->assertJsonPath('data.enrollment.billId', $return->bill->id)->assertJsonPath('data.requirements.previousBalance', 100)
            ->assertJsonPath('data.requirements.newEnrollmentPayment', 200);
        $year->update(['admission_open' => false]);
        $this->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'pending');
        $newBill = $return->bill;
        $this->actingAs($cashier)->postJson("/api/admin/bills/$newBill->id/payments", ['amount' => 200, 'method' => 'cash', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $this->assertSame('pending', $return->fresh()->status);
        $this->postJson("/api/admin/bills/$bill->id/payments", ['amount' => 100, 'method' => 'cash', 'paidAt' => '2027-10-07'])->assertSuccessful();
        $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'enrolled')->assertJsonPath('data.returnDeadline', null);
        $this->assertSame('dropped', $old->fresh()->status);
        $this->assertSame(1, $student->notifications()->where('dedupe_key', 'returning-started:'.$return->id)->count());
    }

    public function test_missing_effective_date_blocks_student_return_with_recovery_message(): void
    {
        extract($this->fixture(null));
        $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'blocked')->assertJsonPath('data.returnDeadline', null);
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
    }

    public function test_expired_pending_return_remains_visible_without_allowing_activation(): void
    {
        extract($this->fixture());
        $this->actingAs($user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful();
        $this->travelTo(Carbon::parse('2028-10-08', 'Asia/Manila'));
        $this->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'blocked')
            ->assertJsonPath('data.enrollment.status', 'pending')->assertJsonPath('data.requirements.eligible', false);
        // A retry finds the same attempt and never creates or activates another.
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful()->assertJsonPath('data.status', 'pending');
        $this->assertSame(2, $student->enrollments()->count());
    }

    public function test_non_dropped_student_cannot_start_a_return(): void
    {
        extract($this->fixture());
        $old->newQuery()->whereKey($old->id)->update(['status' => 'enrolled', 'enrolled_at' => now()]);
        $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'not_applicable');
        $this->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertUnprocessable();
    }

    public function test_dropped_student_can_read_own_historical_documents_after_the_active_year_changes(): void
    {
        extract($this->fixture());
        $document = $student->documents()->create(['school_year_id' => $old->school_year_id, 'semester' => 'first', 'type' => 'clearance', 'file_name' => 'saved.pdf', 's3_key' => 'saved.pdf']);
        $this->actingAs($user)->getJson('/api/me/documents?history=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $document->id)->assertJsonPath('data.0.schoolYear', '2026-2027');
        $this->getJson('/api/me/documents')->assertOk()->assertJsonCount(0, 'data');
        $otherUser = User::factory()->create(['role' => Role::Student]);
        Student::create(['user_id' => $otherUser->id, 'student_number' => 'OTHER', 'first_name' => 'Other', 'last_name' => 'Student', 'status' => 'dropped']);
        $this->actingAs($otherUser)->getJson('/api/me/documents?history=1')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_a_completed_return_is_not_presented_as_an_active_enrollment(): void
    {
        extract($this->fixture());
        $this->actingAs($user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful();
        $return = $student->enrollments()->where('school_year_id', $year->id)->firstOrFail();
        $return->newQuery()->whereKey($return->id)->update(['status' => 'completed', 'enrolled_at' => now()]);
        $this->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'not_applicable')->assertJsonPath('data.returnDeadline', null);
    }

    public function test_changed_return_calendar_is_reported_as_blocked(): void
    {
        extract($this->fixture());
        $this->actingAs($user)->postJson('/api/me/re-enrollment', ['schoolYearId' => $year->id])->assertSuccessful();
        $year->update(['start_date' => '2026-01-01']);
        $this->getJson('/api/me/re-enrollment')->assertOk()->assertJsonPath('data.state', 'blocked')->assertJsonPath('data.requirements.eligible', false);
    }

    public function test_student_sees_the_program_and_grade_approved_by_staff_for_the_return(): void
    {
        extract($this->fixture());
        $program = Program::firstOrCreate(['code' => 'abm'], ['name' => 'ABM', 'category' => 'academic', 'is_active' => true]);
        $this->actingAs($admin)->postJson("/api/admin/students/$student->id/returning-enrollments", [
            'schoolYearId' => $year->id, 'program' => 'abm', 'yearLevel' => 'grade_12', 'discountId' => null,
        ])->assertSuccessful();
        $this->actingAs($user)->getJson('/api/me/re-enrollment')->assertOk()
            ->assertJsonPath('data.state', 'pending')->assertJsonPath('data.source.program', 'stem')
            ->assertJsonPath('data.enrollment.program', 'abm')->assertJsonPath('data.enrollment.programName', $program->name)
            ->assertJsonPath('data.enrollment.yearLevel', 'grade_12');
    }
}
