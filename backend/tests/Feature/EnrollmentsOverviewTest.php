<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnrollmentsOverviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_enrollment_exposes_its_own_bill_even_when_settled_and_other_years_have_debt(): void
    {
        $student = Student::create([
            'user_id' => User::factory()->create(['role' => Role::Student])->id,
            'student_number' => '2026-00009', 'first_name' => 'Berk', 'last_name' => 'Molina',
            'status' => 'enrolled',
        ]);
        $enrollments = [];
        foreach (['partial', 'paid', null] as $index => $status) {
            $year = SchoolYear::create([
                'school_year' => (2026 + $index).'-'.(2027 + $index),
                'start_date' => (2026 + $index).'-06-01', 'end_date' => (2027 + $index).'-03-31',
            ]);
            $enrollment = Enrollment::create([
                'student_id' => $student->id, 'school_year_id' => $year->id,
                'status' => $status === null ? 'pending' : 'enrolled', 'track' => 'gas', 'year_level' => 'grade_11',
            ]);
            $bill = $status === null ? null : Bill::create([
                'student_id' => $student->id, 'enrollment_id' => $enrollment->id, 'school_year_id' => $year->id,
                'total' => 1000, 'amount_paid' => $status === 'paid' ? 1000 : 200, 'status' => $status,
            ]);
            $enrollments[$enrollment->id] = $bill;
        }

        foreach ([Role::Cashier, Role::Admin] as $role) {
            $response = $this->actingAs(User::factory()->create(['role' => $role]))
                ->getJson('/api/admin/enrollments')->assertOk()->assertJsonCount(3, 'data');
            foreach ($response->json('data') as $row) {
                $bill = $enrollments[$row['id']];
                $this->assertArrayHasKey('bill', $row);
                $this->assertSame($bill ? ['id' => $bill->id, 'status' => $bill->status] : null, $row['bill']);
                $this->assertSame($bill !== null, $row['hasBill']);
                $this->assertSame(1, $row['openBillCount']);
                $this->assertSame('partial', $row['openBills'][0]['status']);
                $this->assertSame('2026-2027', $row['openBills'][0]['schoolYear']);
            }
        }

        $this->actingAs($student->user)->getJson('/api/admin/enrollments')->assertForbidden();
    }
}
