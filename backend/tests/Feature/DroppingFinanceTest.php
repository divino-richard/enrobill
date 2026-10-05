<?php

namespace Tests\Feature;

use App\Actions\GenerateInstallmentSchedule;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\DroppingPolicy;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\SchoolYear;
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
        $enrollment = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'status' => 'enrolled', 'track' => 'stem', 'year_level' => 'grade_11', 'dropping_category' => $category, 'enrolled_at' => '2026-04-30']);
        $bill = Bill::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'enrollment_id' => $enrollment->id, 'total' => '11000.03', 'amount_paid' => $paid, 'status' => $paid ? 'partial' : 'unpaid']);
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
    public function test_final_balance_matches_installments_and_preserves_due_dates(float $paid): void
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
        $this->assertEquals($bill->balance(), max(round($bill->installments()->sum('amount') - $bill->effectivePaymentTotal(), 2), 0));
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

    public function test_fully_waived_original_bill_still_receives_a_payable_final_schedule(): void
    {
        [$request, $bill, $admin] = $this->fixture();
        $bill->installments()->delete();
        $bill->adjustments()->create(['label' => 'Original full benefit', 'type' => 'fixed', 'value' => 11000.03, 'amount' => 11000.03]);
        DB::transaction(fn () => app(DroppingFinance::class)->finalize($request, '2026-05-20', $admin->id));
        $this->assertEquals(1000, $bill->fresh()->balance());
        $this->assertEquals(1000, $bill->installments()->sum('amount'));
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
        $this->assertEquals($bill->balance(), $bill->installmentSchedule()->sum('balance'));
        $this->assertEquals($bill->netTotal(), $bill->installments()->sum('amount'));
        $this->assertEquals($dates, $bill->installments()->pluck('due_date')->map->toDateString()->all());

        $bill->payments()->create(['amount' => 500, 'status' => 'verified', 'method' => 'cash', 'paid_at' => now()]);
        $bill->recalculate();
        $this->assertEquals(1500.02, $bill->balance());
        $this->assertEquals($bill->balance(), $bill->installmentSchedule()->sum('balance'));
        $this->assertEquals($dates, $bill->installments()->pluck('due_date')->map->toDateString()->all());
    }
}
