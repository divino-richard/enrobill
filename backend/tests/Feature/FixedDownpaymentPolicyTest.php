<?php

namespace Tests\Feature;

use App\Actions\GenerateInstallmentSchedule;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FixedDownpaymentPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function year(float $amount = 200.25): SchoolYear
    {
        return SchoolYear::create([
            'school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
            'downpayment_value' => $amount, 'installment_count' => 3,
        ]);
    }

    private function bill(SchoolYear $year, float $total, bool $waived = false): Bill
    {
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create([
            'user_id' => $user->id, 'student_number' => 'FIXED-'.$user->id,
            'first_name' => 'Policy', 'last_name' => 'Student', 'status' => 'admitted',
        ]);
        $enrollment = Enrollment::create([
            'student_id' => $student->id, 'school_year_id' => $year->id, 'status' => 'pending',
            'track' => 'gas', 'year_level' => 'grade_11', 'no_downpayment' => $waived,
        ]);

        return Bill::create([
            'student_id' => $student->id, 'school_year_id' => $year->id, 'enrollment_id' => $enrollment->id,
            'total' => $total, 'amount_paid' => 0, 'status' => 'unpaid',
        ]);
    }

    public function test_year_creation_and_policy_updates_need_only_amount_and_count(): void
    {
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $created = $this->postJson('/api/admin/school-years', [
            'startDate' => '2026-06-01', 'endDate' => '2027-03-31',
            'downpaymentValue' => 500.25, 'installmentCount' => 3,
        ])->assertSuccessful()->assertJsonPath('data.downpaymentValue', 500.25);
        $this->assertArrayNotHasKey('downpaymentType', $created->json('data'));
        $id = $created->json('data.id');

        $updated = $this->putJson("/api/admin/school-years/{$id}/installment-policy", [
            'downpaymentValue' => 800, 'installmentCount' => 12,
        ])->assertOk()->assertJsonPath('data.downpaymentValue', 800)->assertJsonPath('data.installmentCount', 12);
        $this->assertArrayNotHasKey('downpaymentType', $updated->json('data'));
        $this->assertFalse(Schema::hasColumn('school_years', 'downpayment_type'));
    }

    public function test_legacy_percentage_requests_cannot_change_or_create_a_policy(): void
    {
        $year = $this->year();
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $payload = ['downpaymentType' => 'percentage', 'downpaymentValue' => 20, 'installmentCount' => 3];
        $this->putJson("/api/admin/school-years/{$year->id}/installment-policy", $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('downpaymentType');
        $this->postJson('/api/admin/school-years', [
            ...$payload, 'startDate' => '2027-06-01', 'endDate' => '2028-03-31',
        ])->assertUnprocessable()->assertJsonValidationErrors('downpaymentType');
        $this->assertSame('200.25', $year->fresh()->downpayment_value);
        $this->assertDatabaseCount('school_years', 1);
    }

    public function test_invalid_amounts_and_counts_are_rejected(): void
    {
        $year = $this->year();
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        foreach ([-1, 100000000, 'not-an-amount'] as $amount) {
            $this->putJson("/api/admin/school-years/{$year->id}/installment-policy", [
                'downpaymentValue' => $amount, 'installmentCount' => 3,
            ])->assertUnprocessable()->assertJsonValidationErrors('downpaymentValue');
        }
        foreach ([0, 25, 1.5] as $count) {
            $this->putJson("/api/admin/school-years/{$year->id}/installment-policy", [
                'downpaymentValue' => 200, 'installmentCount' => $count,
            ])->assertUnprocessable()->assertJsonValidationErrors('installmentCount');
        }
    }

    public function test_fixed_downpayments_do_not_scale_with_bill_totals_and_rounding_reconciles(): void
    {
        $year = $this->year();
        foreach ([1000.10, 2000.10] as $total) {
            $bill = $this->bill($year, $total);
            app(GenerateInstallmentSchedule::class)($bill);
            $rows = $bill->installments()->orderBy('sequence')->get();
            $this->assertCount(4, $rows);
            $this->assertSame(Bill::DOWNPAYMENT_LABEL, $rows[0]->label);
            $this->assertEquals(200.25, $rows[0]->amount);
            $this->assertEquals($total, round((float) $rows->sum('amount'), 2));
            $this->assertSame('2026-06-01', $rows[0]->due_date->toDateString());
            if ($total === 1000.10) {
                $this->assertEquals([200.25, 266.61, 266.61, 266.63], $rows->pluck('amount')->map(fn ($amount) => (float) $amount)->all());
            }
        }
    }

    public function test_downpayments_are_capped_at_the_bill_total_and_waivers_still_apply(): void
    {
        $year = $this->year();
        $small = $this->bill($year, 150);
        app(GenerateInstallmentSchedule::class)($small);
        $this->assertSame(1, $small->installments()->count());
        $this->assertEquals(150, $small->installments()->first()->amount);

        $waived = $this->bill($year, 1000, true);
        app(GenerateInstallmentSchedule::class)($waived);
        $this->assertFalse($waived->installments()->where('label', Bill::DOWNPAYMENT_LABEL)->exists());
        $this->assertSame(3, $waived->installments()->count());
        $this->assertEquals(1000, $waived->installments()->sum('amount'));
    }

    public function test_zero_downpayment_spreads_the_full_balance_over_installments(): void
    {
        $year = $this->year(0);
        $bill = $this->bill($year, 1000);
        app(GenerateInstallmentSchedule::class)($bill);
        $this->assertFalse($bill->installments()->where('label', Bill::DOWNPAYMENT_LABEL)->exists());
        $this->assertSame(3, $bill->installments()->count());
        $this->assertEquals(1000, $bill->installments()->sum('amount'));
    }

    public function test_updating_policy_keeps_existing_schedules_and_bill_api_omits_the_type(): void
    {
        $year = $this->year();
        $bill = $this->bill($year, 1000.10);
        app(GenerateInstallmentSchedule::class)($bill);
        $original = $bill->installments()->get()->toArray();
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $this->putJson("/api/admin/school-years/{$year->id}/installment-policy", [
            'downpaymentValue' => 500, 'installmentCount' => 6,
        ])->assertOk();
        $this->assertSame($original, $bill->installments()->get()->toArray());
        $response = $this->getJson("/api/admin/bills/{$bill->id}")->assertOk();
        $this->assertArrayNotHasKey('downpaymentType', $response->json('data.installmentPolicy'));
    }

    public function test_migration_preserves_amounts_and_refuses_to_reinterpret_a_percentage(): void
    {
        $year = $this->year();
        $bill = $this->bill($year, 1000.10);
        app(GenerateInstallmentSchedule::class)($bill);
        $original = $bill->installments()->get()->toArray();
        $migration = require database_path('migrations/2026_10_17_000000_remove_downpayment_type_from_school_years.php');
        $migration->down();
        DB::table('school_years')->where('id', $year->id)->update(['downpayment_type' => 'percentage']);
        try {
            $migration->up();
            $this->fail('A percentage policy must not become a peso amount implicitly.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('explicit fixed downpayment amount', $error->getMessage());
            $this->assertTrue(Schema::hasColumn('school_years', 'downpayment_type'));
        } finally {
            DB::table('school_years')->where('id', $year->id)->update(['downpayment_type' => 'fixed']);
            $migration->up();
        }
        $this->assertSame('200.25', $year->fresh()->downpayment_value);
        $this->assertSame($original, $bill->installments()->get()->toArray());
        $this->assertFalse(Schema::hasColumn('school_years', 'downpayment_type'));
    }
}
