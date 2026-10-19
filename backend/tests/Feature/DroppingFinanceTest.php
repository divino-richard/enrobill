<?php

namespace Tests\Feature;

use App\Actions\GenerateBillForEnrollment;
use App\Actions\GenerateInstallmentSchedule;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\Discount;
use App\Models\DroppingPolicy;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\SchoolYearFee;
use App\Models\Student;
use App\Models\User;
use App\Services\DroppingFinance;
use App\Services\StudentCreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DroppingFinanceTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(string $category = 'paying', float $paid = 0): array
    {
        $this->travelTo(Carbon::parse('2027-04-01', 'Asia/Manila'));
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'F-'.$user->id, 'status' => 'enrolled', 'first_name' => 'Test', 'last_name' => 'Student']);
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $enrollment = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'status' => 'enrolled', 'track' => 'stem', 'year_level' => 'grade_11', 'enrolled_at' => '2026-04-30']);
        $bill = Bill::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'enrollment_id' => $enrollment->id, 'total' => '11000.03', 'amount_paid' => $paid, 'status' => $paid ? 'partial' : 'unpaid']);
        if ($category === 'voucher_esc') {
            $voucher = Discount::create(['name' => 'School voucher', 'category' => 'voucher', 'type' => 'fixed', 'value' => 1000, 'is_active' => true]);
            $bill->adjustments()->create(['discount_id' => $voucher->id, 'label' => $voucher->name, 'type' => 'fixed', 'value' => 1000, 'amount' => 1000]);
        }
        foreach (['registration' => '1000.00', 'miscellaneous' => '2000.01', 'laboratory' => '1000.00', 'tuition' => '6000.01', 'other' => '1000.01'] as $component => $amount) {
            $bill->items()->create(['name' => $component, 'category' => 'other', 'dropping_component' => $component, 'amount' => $amount]);
        }
        $bill->installments()->createMany([
            ['sequence' => 1, 'label' => 'Downpayment', 'amount' => '2000.00', 'due_date' => '2026-05-01'],
            ['sequence' => 2, 'label' => 'First', 'amount' => '4000.00', 'due_date' => '2026-07-01'],
            ['sequence' => 3, 'label' => 'Second', 'amount' => '5000.03', 'due_date' => '2026-09-01'],
        ]);
        if ($paid > 0) {
            $bill->payments()->create(['amount' => $paid, 'status' => 'verified', 'method' => 'cash', 'paid_at' => '2026-05-01']);
        }
        $request = DroppingRequest::create(['student_id' => $student->id, 'enrollment_id' => $enrollment->id, 'active_enrollment_id' => $enrollment->id, 'status' => 'submitted', 'snapshot' => [], 'submissions' => [], 'events' => []]);
        $policy = DroppingPolicy::create(['school_year_id' => $year->id, 'version' => 1, 'enabled' => true, 'periods' => DroppingPolicyConfigurationTest::periods()]);
        $admin = User::factory()->create(['role' => Role::Admin]);

        return [$request, $bill, $admin, $policy];
    }

    public function test_editing_one_period_keeps_legacy_calculations_and_classification_checks_for_other_periods(): void
    {
        [$request, $bill, $admin, $policy] = $this->fixture();
        $fee = SchoolYearFee::create(['school_year_id' => $bill->school_year_id, 'year_level' => 'all', 'category' => 'other', 'type' => 'default', 'name' => 'registration', 'amount' => 1000]);
        $this->actingAs($admin)->putJson("/api/admin/school-years/{$bill->school_year_id}/dropping-policy/periods/enrollment", [
            ...$policy->periods['enrollment'], 'feeRules' => ['paying' => [['feeId' => $fee->id, 'percent' => 50]]],
        ])->assertOk();
        $finance = app(DroppingFinance::class);
        $changed = $finance->preview($request, '2026-05-01');
        $this->assertTrue($changed['ready'], implode(' ', $changed['issues']));
        $this->assertEquals(500, $changed['finalCharge']);
        $unchanged = $finance->preview($request, '2026-06-01');
        $this->assertTrue($unchanged['ready'], implode(' ', $unchanged['issues']));
        $this->assertEquals(3000.01, $unchanged['finalCharge']);
        $bill->items()->where('name', 'miscellaneous')->update(['dropping_component' => null]);
        $this->assertFalse($finance->preview($request, '2026-06-01')['ready']);
    }

    public static function cases(): array
    {
        $cases = [];
        foreach (['paying' => [1000, 3000.01, 6000.02, 11000.03, 11000.03], 'voucher_esc' => [1000, 1000.01, 2000.01, 3000.01, 5500.02]] as $category => $charges) {
            foreach (DroppingPolicyConfigurationTest::periods() as $period => $range) {
                $expected = array_shift($charges);
                foreach ($range as $boundary => $date) {
                    $cases["$category $period $boundary"] = [$category, $period, $date, $expected];
                }
            }
        }

        return $cases;
    }

    #[DataProvider('cases')]
    public function test_every_category_period_boundary_and_cent_rounding(string $category, string $period, string $date, float $expected): void
    {
        [$request] = $this->fixture($category);
        $preview = app(DroppingFinance::class)->preview($request, $date);
        $this->assertTrue($preview['ready'], implode(' ', $preview['issues']));
        $this->assertSame($period, $preview['period']);
        $this->assertEquals($expected, $preview['finalCharge']);
        $this->assertEquals(11000.03, $preview['originalTotal']);
        $this->assertEquals(2000.01, $preview['feeBreakdown']['miscellaneous']);
    }

    public static function payments(): array
    {
        return [[0], [400.25], [1000], [7000]];
    }

    #[DataProvider('payments')]
    public function test_final_balance_is_deferred_and_original_installments_are_preserved(float $paid): void
    {
        [$request, $bill, $admin] = $this->fixture('paying', $paid);
        $dates = $bill->installments()->pluck('due_date')->map->toDateString()->all();
        $original = $bill->installments()->get()->toArray();
        $final = DB::transaction(fn () => app(DroppingFinance::class)->finalize($request, '2026-05-20', $admin->id));
        $bill->refresh();
        $this->assertEquals(1000, $bill->netTotal());
        $this->assertEquals(max(1000 - $paid, 0), $bill->balance());
        $this->assertEquals(max($paid - 1000, 0), $final['credit']);
        $this->assertEquals($dates, $bill->installments()->pluck('due_date')->map->toDateString()->all());
        $this->assertEquals($original, $final['originalInstallments']);
        $this->assertEquals($original, $bill->installments()->get()->toArray());
        $this->assertSame(0.0, $bill->amountDue());
        $this->assertCount(0, $bill->installmentSchedule());
    }

    public function test_credit_allocates_once_to_later_year_and_releases_after_new_benefits(): void
    {
        [$request, $bill, $admin] = $this->fixture('paying', 7000);
        DB::transaction(fn () => app(DroppingFinance::class)->finalize($request, '2026-05-20', $admin->id));
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31']);
        $enrollment = Enrollment::create(['student_id' => $bill->student_id, 'school_year_id' => $year->id, 'status' => 'pending', 'track' => 'stem', 'year_level' => 'grade_11']);
        $target = Bill::create(['student_id' => $bill->student_id, 'enrollment_id' => $enrollment->id, 'school_year_id' => $year->id, 'total' => 5000, 'amount_paid' => 0, 'status' => 'unpaid']);
        $credits = app(StudentCreditService::class);
        $credits->applyToBill($target, $admin->id);
        $credits->applyToBill($target, $admin->id);
        $target->refresh()->recalculate();
        $this->assertEquals(5000, $target->creditApplied());
        $this->assertEquals(0, $target->amount_paid);
        $this->assertEquals(1000, $credits->availableFor($bill->student_id));
        $this->assertSame(1, $target->creditAllocations()->count());
        $target->adjustments()->create(['label' => 'New voucher', 'type' => 'fixed', 'value' => 2000, 'amount' => 2000]);
        $target->refresh()->recalculate();
        $this->assertEquals(3000, $target->creditApplied());
        $this->assertEquals(3000, $credits->availableFor($bill->student_id));
        $this->assertEquals(0, $target->balance());
        $this->assertEquals(2000, $target->creditAllocations()->first()->released_amount);
    }

    public function test_fully_waived_original_bill_keeps_final_balance_without_a_new_schedule(): void
    {
        [$request, $bill, $admin] = $this->fixture();
        $bill->installments()->delete();
        $bill->adjustments()->create(['label' => 'Original full benefit', 'type' => 'fixed', 'value' => 11000.03, 'amount' => 11000.03]);
        DB::transaction(fn () => app(DroppingFinance::class)->finalize($request, '2026-05-20', $admin->id));
        $this->assertEquals(1000, $bill->fresh()->balance());
        $this->assertCount(0, $bill->installments);
        $this->assertSame(0.0, $bill->fresh()->amountDue());
    }

    public function test_prior_benefit_cannot_hide_final_balance_when_payments_exceed_the_old_schedule(): void
    {
        [$request, $bill, $admin] = $this->fixture('paying', 4000);
        $bill->adjustments()->create(['label' => 'Prior benefit', 'type' => 'fixed', 'value' => 8000, 'amount' => 8000]);
        app(GenerateInstallmentSchedule::class)($bill->fresh());
        $dates = $bill->installments()->pluck('due_date')->map->toDateString()->all();
        $this->assertEquals(3000.03, $bill->installments()->sum('amount'));

        DB::transaction(fn () => app(DroppingFinance::class)->finalize($request, '2026-09-30', $admin->id));
        $bill->refresh();
        $this->assertEquals(6000.02, $bill->netTotal());
        $this->assertEquals(2000.02, $bill->balance());
        $this->assertCount(0, $bill->installmentSchedule());
        $this->assertSame(0.0, $bill->amountDue());
        $this->assertEquals(3000.03, $bill->installments()->sum('amount'));
        $this->assertEquals($dates, $bill->installments()->pluck('due_date')->map->toDateString()->all());

        $bill->payments()->create(['amount' => 500, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
        $this->assertEquals(1500.02, $bill->balance());
        $this->assertCount(0, $bill->installmentSchedule());
        $this->assertSame(0.0, $bill->amountDue());
        $this->assertEquals($dates, $bill->installments()->pluck('due_date')->map->toDateString()->all());
    }

    public function test_selected_fees_use_original_bill_amounts_and_automatic_category_and_remain_frozen(): void
    {
        [$request, $bill, $admin, $policy] = $this->fixture('voucher_esc');
        $item = $bill->items()->where('name', 'tuition')->firstOrFail();
        $item->update(['source_fee_id' => 123, 'name' => 'Original tuition', 'dropping_component' => null]);
        $rule = ['feeId' => 123, 'percent' => 50, 'name' => 'Current tuition', 'category' => 'tuition', 'yearLevel' => 'all'];
        $rules = array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(DroppingPolicy::PERIODS, [$rule]));
        $rules['paying']['enrollment'][0]['percent'] = 100;
        $policy->update(['fee_rules' => $rules]);
        $preview = app(DroppingFinance::class)->preview($request, '2026-05-20');
        $this->assertTrue($preview['ready'], implode(' ', $preview['issues']));
        $this->assertEquals(3000.01, $preview['finalCharge']);
        $this->assertEquals('Original tuition', $preview['feeCharges'][0]['name']);
        $this->assertEquals(6000.01, $preview['feeCharges'][0]['originalAmount']);
        $final = DB::transaction(fn () => app(DroppingFinance::class)->finalize($request, '2026-05-20', $admin->id));
        $rules['voucher_esc']['enrollment'][0]['percent'] = 100;
        $policy->update(['fee_rules' => $rules]);
        $this->assertEquals($final, app(DroppingFinance::class)->preview($request, '2026-05-20'));
    }

    public function test_legacy_bill_matches_must_be_exact_and_unambiguous_and_grade_specific_fees_are_excluded(): void
    {
        [$request, $bill, , $policy] = $this->fixture();
        $rule = ['feeId' => 123, 'percent' => 50, 'name' => 'tuition', 'category' => 'other', 'yearLevel' => 'all'];
        $grade12 = ['feeId' => 124, 'percent' => 100, 'name' => 'Grade 12 add-on', 'category' => 'other', 'yearLevel' => 'grade_12'];
        $rules = array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(DroppingPolicy::PERIODS, [$rule, $grade12]));
        $policy->update(['fee_rules' => $rules]);
        $preview = app(DroppingFinance::class)->preview($request, '2026-05-20');
        $this->assertTrue($preview['ready'], implode(' ', $preview['issues']));
        $this->assertEquals(3000.01, $preview['finalCharge']);
        $this->assertCount(1, $preview['feeCharges']);
        $bill->items()->where('name', 'other')->firstOrFail()->update(['name' => 'tuition']);
        $preview = app(DroppingFinance::class)->preview($request, '2026-05-20');
        $this->assertFalse($preview['ready']);
        $this->assertStringContainsString('could not be matched uniquely', implode(' ', $preview['issues']));
        $bill->items()->where('dropping_component', 'tuition')->firstOrFail()->update(['source_fee_id' => 123]);
        // An unlinked duplicate is still ambiguous; explicitly link both lines.
        $bill->items()->where('dropping_component', 'other')->firstOrFail()->update(['source_fee_id' => 999]);
        $this->assertTrue(app(DroppingFinance::class)->preview($request, '2026-05-20')['ready']);
    }

    public function test_older_bill_without_links_or_classifications_is_matched_and_approved_automatically(): void
    {
        [$request, $bill, $admin, $policy] = $this->fixture();
        $bill->items()->update(['dropping_component' => null]);
        $originalItems = $bill->items()->get()->toArray();
        $rules = [
            ['feeId' => 123, 'percent' => 100, 'name' => 'registration', 'category' => 'other', 'yearLevel' => 'all'],
            ['feeId' => 124, 'percent' => 50, 'name' => 'laboratory', 'category' => 'other', 'yearLevel' => 'grade_11'],
        ];
        $policy->update(['fee_rules' => array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(DroppingPolicy::PERIODS, $rules))]);

        $finance = app(DroppingFinance::class);
        $preview = $finance->preview($request, '2026-05-20');
        $this->assertTrue($preview['ready'], implode(' ', $preview['issues']));
        $this->assertEquals(1500, $preview['finalCharge']);
        $this->assertCount(2, $preview['feeCharges']);
        $final = DB::transaction(fn () => $finance->finalize($request, '2026-05-20', $admin->id));
        $this->assertEquals(1500, $final['finalCharge']);
        $this->assertSame($originalItems, $bill->items()->get()->toArray());
    }

    public function test_changed_or_missing_bill_fee_links_invalidate_the_approval_preview(): void
    {
        [$request, $bill, , $policy] = $this->fixture();
        $rule = ['feeId' => 123, 'percent' => 50, 'name' => 'tuition', 'category' => 'other', 'yearLevel' => 'all'];
        $policy->update(['fee_rules' => array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(DroppingPolicy::PERIODS, [$rule]))]);
        $before = app(DroppingFinance::class)->preview($request, '2026-05-20');
        $bill->items()->where('name', 'tuition')->firstOrFail()->update(['source_fee_id' => 999]);
        $after = app(DroppingFinance::class)->preview($request, '2026-05-20');
        $this->assertFalse($after['ready']);
        $this->assertNotSame($before['fingerprint'], $after['fingerprint']);
    }

    public function test_a_policy_with_no_applicable_grade_fees_cannot_silently_approve_a_zero_charge(): void
    {
        [$request, , , $policy] = $this->fixture();
        $rule = ['feeId' => 123, 'percent' => 100, 'name' => 'Grade 12 fee', 'category' => 'other', 'yearLevel' => 'grade_12'];
        $policy->update(['fee_rules' => array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(DroppingPolicy::PERIODS, [$rule]))]);
        $preview = app(DroppingFinance::class)->preview($request, '2026-05-20');
        $this->assertFalse($preview['ready']);
        $this->assertStringContainsString('grade level', implode(' ', $preview['issues']));
    }

    public function test_bill_fee_links_reject_other_years_grades_and_duplicate_sources(): void
    {
        [, $bill, $admin] = $this->fixture();
        $this->actingAs($admin);
        $fee = SchoolYearFee::create(['school_year_id' => $bill->school_year_id, 'year_level' => 'all', 'category' => 'other', 'type' => 'default', 'name' => 'Registration', 'amount' => 1000]);
        $items = $bill->items()->take(2)->get();
        $url = "/api/admin/bills/{$bill->id}/dropping-classification";
        $input = ['items' => [['id' => $items[0]->id, 'component' => null, 'sourceFeeId' => $fee->id]]];
        $this->putJson($url, $input)->assertOk();
        $this->assertEquals($fee->id, $items[0]->fresh()->source_fee_id);
        $input['items'][] = ['id' => $items[1]->id, 'component' => 'other', 'sourceFeeId' => $fee->id];
        $this->putJson($url, $input)->assertUnprocessable();
        $this->assertNull($items[1]->fresh()->source_fee_id);
        $fee->update(['year_level' => 'grade_12']);
        $input['items'] = [$input['items'][1]];
        $this->putJson($url, $input)->assertUnprocessable();
        $other = SchoolYear::create(['school_year' => '2027-2028']);
        $fee->update(['school_year_id' => $other->id, 'year_level' => 'all']);
        $this->putJson($url, $input)->assertUnprocessable();
        $fee->delete();
        // An unchanged historical identity survives catalog removal.
        $input['items'][0]['id'] = $items[0]->id;
        $this->putJson($url, $input)->assertOk();
    }

    public function test_new_bill_items_retain_their_catalog_identity_and_original_amount(): void
    {
        [, $original, $admin] = $this->fixture();
        $year = SchoolYear::create(['school_year' => '2027-2028', 'start_date' => '2027-06-01', 'end_date' => '2028-03-31', 'downpayment_value' => 100, 'installment_count' => 2]);
        $fee = SchoolYearFee::create(['school_year_id' => $year->id, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 1500]);
        $enrollment = Enrollment::create(['student_id' => $original->student_id, 'school_year_id' => $year->id, 'status' => 'pending', 'track' => 'stem', 'year_level' => 'grade_11']);
        $bill = app(GenerateBillForEnrollment::class)($enrollment);
        $item = $bill->items()->firstOrFail();
        $this->assertEquals($fee->id, $item->source_fee_id);
        $this->assertNull($item->dropping_component);
        $fee->update(['amount' => 2500]);
        $this->assertEquals(1500, $item->fresh()->amount);
        $fee->delete();
        $this->assertEquals($item->source_fee_id, $item->fresh()->source_fee_id);

        $this->travelTo(Carbon::parse('2028-04-01', 'Asia/Manila'));
        $periods = array_map(fn ($range) => array_map(fn ($date) => Carbon::parse($date)->addYear()->toDateString(), $range), DroppingPolicyConfigurationTest::periods());
        $rule = ['feeId' => $fee->id, 'percent' => 50, 'name' => 'Tuition', 'category' => 'tuition', 'yearLevel' => 'all'];
        DroppingPolicy::create(['school_year_id' => $year->id, 'version' => 1, 'enabled' => true, 'periods' => $periods,
            'fee_rules' => array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(DroppingPolicy::PERIODS, [$rule]))]);
        $request = DroppingRequest::create(['student_id' => $bill->student_id, 'enrollment_id' => $enrollment->id,
            'active_enrollment_id' => $enrollment->id, 'status' => 'submitted', 'snapshot' => [], 'submissions' => [], 'events' => []]);
        $final = DB::transaction(fn () => app(DroppingFinance::class)->finalize($request, '2027-06-01', $admin->id));
        $this->assertEquals(750, $final['finalCharge']);
        $this->assertEquals(1500, $final['feeCharges'][0]['originalAmount']);
    }

    public function test_fee_edits_without_a_classification_field_preserve_existing_historical_metadata(): void
    {
        [, $bill, $admin] = $this->fixture();
        $fee = SchoolYearFee::create(['school_year_id' => $bill->school_year_id, 'year_level' => 'all', 'category' => 'miscellaneous',
            'type' => 'default', 'name' => 'Registration', 'dropping_component' => 'registration', 'amount' => 500]);
        $this->actingAs($admin)->putJson("/api/admin/fees/{$fee->id}", [
            'yearLevel' => 'all', 'category' => 'miscellaneous', 'type' => 'default', 'name' => 'Registration', 'amount' => 600,
        ])->assertOk();
        $this->assertSame('registration', $fee->fresh()->dropping_component);
        $this->assertEquals(600, $fee->fresh()->amount);
    }
}
