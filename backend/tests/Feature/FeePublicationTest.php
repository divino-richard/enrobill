<?php

namespace Tests\Feature;

use App\Actions\GenerateBillForEnrollment;
use App\Enums\Role;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeePublicationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): void
    {
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
    }

    private function year(array $attributes = []): SchoolYear
    {
        return SchoolYear::create(array_merge([
            'school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31',
            'is_active' => true, 'downpayment_value' => 200.25, 'installment_count' => 3,
        ], $attributes));
    }

    private function fees(SchoolYear $year): void
    {
        $year->fees()->createMany([
            ['name' => 'Tuition', 'category' => 'tuition', 'type' => 'default', 'year_level' => 'all', 'amount' => 1000.10, 'sequence' => 1],
            ['name' => 'Graduation', 'category' => 'other', 'type' => 'add_on', 'year_level' => 'grade_12', 'amount' => 50, 'sequence' => 2],
        ]);
    }

    public function test_new_year_starts_with_draft_fees_and_closed_admissions(): void
    {
        $this->admin();
        $response = $this->postJson('/api/admin/school-years', [
            'startDate' => '2027-06-01', 'endDate' => '2028-03-31', 'downpaymentValue' => 200, 'installmentCount' => 3,
        ])->assertSuccessful()->assertJsonPath('data.feesPublishedAt', null)->assertJsonPath('data.admissionOpen', false);
        $this->assertArrayHasKey('feesPublishedAt', $response->json('data'));
        $this->assertGreaterThan(0, SchoolYear::findOrFail($response->json('data.id'))->fees()->count());
        $this->assertDatabaseCount('bills', 0);
    }

    public function test_new_year_copies_latest_earlier_published_schedule_only(): void
    {
        $source = $this->year(['fees_published_at' => now()]);
        $this->fees($source);
        $draft = $this->year(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'is_active' => false]);
        $draft->fees()->create(['name' => 'Unreviewed', 'amount' => 999, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default']);
        $future = $this->year(['school_year' => '2030-2031', 'start_date' => '2030-06-01', 'is_active' => false, 'fees_published_at' => now()]);
        $future->fees()->create(['name' => 'Future', 'amount' => 888, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default']);
        $this->admin();
        $id = $this->postJson('/api/admin/school-years', [
            'startDate' => '2028-06-01', 'endDate' => '2029-03-31', 'downpaymentValue' => 200, 'installmentCount' => 3,
        ])->assertSuccessful()->assertJsonPath('data.feesPublishedAt', null)->json('data.id');
        $this->assertSame(['Tuition', 'Graduation'], SchoolYear::findOrFail($id)->fees()->orderBy('sequence')->pluck('name')->all());
        $this->assertEquals([1000.10, 50], SchoolYear::findOrFail($id)->fees()->orderBy('sequence')->pluck('amount')->all());
    }

    public function test_only_admin_can_publish_and_admissions_require_publication(): void
    {
        $year = $this->year();
        $this->fees($year);
        $this->admin();
        $this->putJson("/api/admin/school-years/$year->id", ['admissionOpen' => true])->assertUnprocessable();
        $this->actingAs(User::factory()->create(['role' => Role::Cashier]));
        $this->postJson("/api/admin/school-years/$year->id/fees/publish")->assertForbidden();
        $this->admin();
        $this->postJson("/api/admin/school-years/$year->id/fees/publish")->assertOk();
        $this->assertNotNull($year->fresh()->fees_published_at);
        $this->assertFalse($year->fresh()->admission_open);
        $this->putJson("/api/admin/school-years/$year->id", ['admissionOpen' => true])->assertOk();
    }

    public function test_incomplete_fees_or_policy_cannot_be_published(): void
    {
        $year = $this->year();
        $this->admin();
        $this->postJson("/api/admin/school-years/$year->id/fees/publish")->assertUnprocessable();
        $year->fees()->create(['name' => 'Tuition', 'amount' => 100, 'year_level' => 'grade_11', 'category' => 'tuition', 'type' => 'default']);
        $this->postJson("/api/admin/school-years/$year->id/fees/publish")->assertUnprocessable();
        $year->fees()->update(['year_level' => 'all']);
        $year->update(['installment_count' => 0]);
        $this->postJson("/api/admin/school-years/$year->id/fees/publish")->assertUnprocessable();
    }

    public function test_published_fees_and_policy_are_locked_until_returned_to_draft(): void
    {
        $year = $this->year(['fees_published_at' => now(), 'admission_open' => true]);
        $this->fees($year);
        $fee = $year->fees()->first();
        $payload = ['schoolYearId' => $year->id, 'yearLevel' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Changed', 'amount' => 400];
        $this->admin();
        $this->postJson('/api/admin/fees', $payload)->assertUnprocessable();
        $this->putJson("/api/admin/fees/$fee->id", $payload)->assertUnprocessable();
        $this->deleteJson("/api/admin/fees/$fee->id")->assertUnprocessable();
        $this->putJson("/api/admin/school-years/$year->id/installment-policy", ['downpaymentValue' => 100, 'installmentCount' => 2])->assertUnprocessable();
        $this->postJson("/api/admin/school-years/$year->id/fees/draft")->assertOk()->assertJsonPath('data.admissionOpen', false)->assertJsonPath('data.feesPublishedAt', null);
        $this->putJson("/api/admin/fees/$fee->id", $payload)->assertOk();
        $this->assertSame('400.00', $fee->fresh()->amount);
    }

    public function test_applicant_estimate_filters_grade_and_rounds_like_actual_bill_without_creating_records(): void
    {
        $year = $this->year(['fees_published_at' => now(), 'admission_open' => true]);
        $this->fees($year);
        $this->actingAs(User::factory()->create(['role' => Role::Applicant]));
        $this->getJson('/api/fee-estimate?school_year=2026-2027&year_level=grade_11')
            ->assertOk()->assertJsonCount(1, 'data.items')->assertJsonPath('data.total', 1000.1)
            ->assertJsonPath('data.downpayment', 200.25)->assertJsonPath('data.installments', [266.61, 266.61, 266.63]);
        $this->getJson('/api/fee-estimate?school_year=2026-2027&year_level=grade_12')
            ->assertOk()->assertJsonCount(2, 'data.items')->assertJsonPath('data.total', 1050.1);
        $this->assertDatabaseCount('bills', 0);
        $this->assertDatabaseCount('enrollments', 0);
        $this->getJson('/api/fee-estimate?school_year=2026-2027&year_level=all')->assertUnprocessable();
        $this->getJson('/api/fee-estimate?school_year=2025-2026&year_level=grade_11')->assertNotFound();
        $year->update(['fees_published_at' => null]);
        $this->getJson('/api/fee-estimate?school_year=2026-2027&year_level=grade_11')->assertNotFound();
        $this->getJson('/api/open-term')->assertOk()->assertJsonPath('data', null);
    }

    public function test_zero_fees_and_downpayment_above_total_have_no_negative_installments(): void
    {
        $year = $this->year(['fees_published_at' => now(), 'admission_open' => true, 'downpayment_value' => 2000]);
        $this->fees($year);
        $this->actingAs(User::factory()->create(['role' => Role::Applicant]));
        $this->getJson('/api/fee-estimate?school_year=2026-2027&year_level=grade_11')->assertOk()
            ->assertJsonPath('data.downpayment', 1000.1)->assertJsonPath('data.installments', []);
        $year->fees()->update(['amount' => 0]);
        $this->getJson('/api/fee-estimate?school_year=2026-2027&year_level=grade_11')->assertOk()
            ->assertJsonPath('data.total', 0)->assertJsonPath('data.downpayment', 0)->assertJsonPath('data.installments', []);
    }

    public function test_draft_cannot_generate_new_bill_and_later_fee_edits_preserve_existing_bill(): void
    {
        $year = $this->year();
        $this->fees($year);
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'FEES-1', 'first_name' => 'Test', 'last_name' => 'Student', 'status' => 'admitted']);
        $enrollment = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'track' => 'gas', 'year_level' => 'grade_11', 'status' => 'pending']);
        $this->actingAs(User::factory()->create(['role' => Role::Cashier]));
        $this->postJson("/api/admin/enrollments/$enrollment->id/bill")->assertUnprocessable();
        $this->assertDatabaseCount('bills', 0);
        $this->admin();
        $this->postJson("/api/admin/school-years/$year->id/fees/publish")->assertOk();
        $bill = app(GenerateBillForEnrollment::class)($enrollment);
        $this->assertEquals([200.25, 266.61, 266.61, 266.63], $bill->installments()->orderBy('sequence')->pluck('amount')->all());
        $this->postJson("/api/admin/school-years/$year->id/fees/draft")->assertOk();
        $fee = $year->fees()->first();
        $this->putJson("/api/admin/fees/$fee->id", ['yearLevel' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 5000])->assertOk();
        $this->assertSame('1000.10', $bill->fresh()->total);
        $this->assertSame('1000.10', $bill->items()->first()->amount);
        $this->assertDatabaseCount('bills', 1);
    }
}
