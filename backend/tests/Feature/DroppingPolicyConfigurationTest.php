<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\SchoolYear;
use App\Models\SchoolYearFee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DroppingPolicyConfigurationTest extends TestCase
{
    use RefreshDatabase;

    public static function periods(): array
    {
        return [
            'enrollment' => ['startsOn' => '2026-05-01', 'endsOn' => '2026-05-31'],
            'quarter_1' => ['startsOn' => '2026-06-01', 'endsOn' => '2026-08-31'],
            'quarter_2' => ['startsOn' => '2026-09-01', 'endsOn' => '2026-10-31'],
            'quarter_3' => ['startsOn' => '2026-11-01', 'endsOn' => '2027-01-31'],
            'quarter_4' => ['startsOn' => '2027-02-01', 'endsOn' => '2027-03-31'],
        ];
    }

    public function test_admin_can_version_a_complete_calendar_and_others_cannot_change_it(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $url = "/api/admin/school-years/{$year->id}/dropping-policy";
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $this->getJson($url)->assertOk()->assertJsonPath('data.enabled', false);
        $this->putJson($url, ['enabled' => true, 'periods' => self::periods()])->assertOk()->assertJsonPath('data.version', 1);
        $this->putJson($url, ['enabled' => false, 'periods' => self::periods()])->assertOk()->assertJsonPath('data.version', 2);
        $this->assertDatabaseCount('dropping_policies', 2);
        $this->getJson($url)->assertJsonPath('data.enabled', false)->assertJsonPath('data.version', 2);
        $this->deleteJson('/api/admin/school-years/'.$year->id)->assertUnprocessable();
        foreach ([Role::Cashier, Role::Student] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))->putJson($url, ['enabled' => true, 'periods' => self::periods()])->assertForbidden();
        }
    }

    public function test_calendar_rejects_gaps_overlaps_missing_periods_and_incomplete_coverage(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        foreach (['2026-08-31', '2026-09-02'] as $boundary) {
            $periods = self::periods();
            $periods['quarter_2']['startsOn'] = $boundary;
            $this->putJson("/api/admin/school-years/{$year->id}/dropping-policy", ['enabled' => true, 'periods' => $periods])->assertUnprocessable();
        }
        $periods = self::periods();
        unset($periods['quarter_3']);
        $this->putJson("/api/admin/school-years/{$year->id}/dropping-policy", ['enabled' => true, 'periods' => $periods])->assertUnprocessable();
        $periods = self::periods();
        $periods['quarter_4']['endsOn'] = '2027-03-30';
        $this->putJson("/api/admin/school-years/{$year->id}/dropping-policy", ['enabled' => true, 'periods' => $periods])->assertUnprocessable();
        $this->assertDatabaseCount('dropping_policies', 0);
    }

    public function test_fee_rules_are_scoped_validated_snapshotted_and_preserved_on_date_only_saves(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $fee = SchoolYearFee::create(['school_year_id' => $year->id, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 2000]);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $url = "/api/admin/school-years/{$year->id}/dropping-policy";
        $rules = array_fill_keys(['paying', 'voucher_esc'], array_fill_keys(array_keys(self::periods()), [['feeId' => $fee->id, 'percent' => 50]]));
        $payload = ['enabled' => true, 'periods' => self::periods(), 'feeRules' => $rules];
        $this->putJson($url, $payload)->assertOk()->assertJsonPath('data.feeRules.paying.enrollment.0.name', 'Tuition')->assertJsonPath('data.feeRules.paying.enrollment.0.percent', 50);
        $fee->update(['name' => 'Renamed fee', 'amount' => 9999]);
        $this->getJson($url)->assertJsonPath('data.feeRules.paying.enrollment.0.name', 'Tuition');
        $this->putJson($url, ['enabled' => false, 'periods' => self::periods()])->assertOk()->assertJsonPath('data.feeRules.paying.enrollment.0.name', 'Tuition');
        foreach ([0, 101, 50.5] as $percent) {
            $bad = $payload;
            $bad['feeRules']['paying']['enrollment'][0]['percent'] = $percent;
            $this->putJson($url, $bad)->assertUnprocessable();
        }
        $bad = $payload;
        $bad['feeRules']['paying']['enrollment'][] = $bad['feeRules']['paying']['enrollment'][0];
        $this->putJson($url, $bad)->assertUnprocessable();
        $bad['feeRules'] = [];
        $this->putJson($url, $bad)->assertUnprocessable();
        $bad['feeRules'] = ['paying' => $rules['paying']];
        $this->putJson($url, $bad)->assertUnprocessable();
        $other = SchoolYear::create(['school_year' => '2027-2028']);
        $fee->update(['school_year_id' => $other->id]);
        $this->putJson($url, $payload)->assertUnprocessable();
        $this->assertDatabaseCount('dropping_policies', 2);
    }

    public function test_periods_save_independently_and_activate_only_when_dates_and_both_categories_are_complete(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $fee = SchoolYearFee::create(['school_year_id' => $year->id, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 2000]);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $url = "/api/admin/school-years/{$year->id}/dropping-policy";
        $rule = [['feeId' => $fee->id, 'percent' => 50]];
        // Any period may be configured first; one category can be saved at a time.
        $this->putJson("$url/periods/quarter_2", [...self::periods()['quarter_2'], 'feeRules' => ['paying' => $rule]])
            ->assertOk()->assertJsonPath('data.enabled', false)->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.feeRules.voucher_esc.quarter_2', []);
        foreach (self::periods() as $period => $dates) {
            if ($period === 'quarter_2') {
                continue;
            }
            $this->putJson("$url/periods/$period", [...$dates, 'feeRules' => ['paying' => $rule, 'voucher_esc' => $rule]])
                ->assertOk()->assertJsonPath('data.enabled', false);
        }
        $fee->update(['name' => 'New tuition name']);
        $this->putJson("$url/periods/quarter_2", [...self::periods()['quarter_2'], 'feeRules' => ['voucher_esc' => $rule]])
            ->assertOk()->assertJsonPath('data.enabled', true)->assertJsonPath('data.version', 6)
            ->assertJsonPath('data.feeRules.paying.quarter_2.0.name', 'Tuition')
            ->assertJsonPath('data.feeRules.voucher_esc.quarter_2.0.name', 'New tuition name')
            ->assertJsonPath('data.periods.enrollment', self::periods()['enrollment']);
        // Gaps can be saved while adjusting neighboring dates, but block use.
        $this->putJson("$url/periods/quarter_2", ['startsOn' => '2026-09-02', 'endsOn' => '2026-10-31', 'feeRules' => ['paying' => $rule]])
            ->assertOk()->assertJsonPath('data.enabled', false);
        $this->assertDatabaseCount('dropping_policies', 7);
        $this->assertDatabaseHas('dropping_policies', ['version' => 6, 'enabled' => true]);
    }

    public function test_period_save_validates_scope_dates_and_access(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $fee = SchoolYearFee::create(['school_year_id' => $year->id, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 2000]);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $url = "/api/admin/school-years/{$year->id}/dropping-policy/periods";
        $payload = [...self::periods()['quarter_1'], 'feeRules' => ['paying' => [['feeId' => $fee->id, 'percent' => 100]]]];
        $this->putJson("$url/quarter_1", $payload)->assertOk();
        $this->putJson("$url/quarter_2", $payload)->assertUnprocessable();
        $this->putJson("$url/invalid", $payload)->assertNotFound();
        foreach ([[], ['paying' => []], ['paying' => [['feeId' => $fee->id, 'percent' => 0]]], ['paying' => [['feeId' => $fee->id, 'percent' => 100], ['feeId' => $fee->id, 'percent' => 100]]]] as $rules) {
            $this->putJson("$url/quarter_1", [...$payload, 'feeRules' => $rules])->assertUnprocessable();
        }
        $this->putJson("$url/quarter_1", [...$payload, 'startsOn' => '2026-09-01'])->assertUnprocessable();
        $otherYear = SchoolYear::create(['school_year' => '2027-2028']);
        $fee->update(['school_year_id' => $otherYear->id]);
        $this->putJson("$url/quarter_1", $payload)->assertUnprocessable();
        foreach ([Role::Cashier, Role::Student] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))->putJson("$url/quarter_1", $payload)->assertForbidden();
        }
        $this->assertDatabaseCount('dropping_policies', 1);
    }

    public function test_shared_dates_and_category_fees_can_be_saved_without_overwriting_each_other(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $fee = SchoolYearFee::create(['school_year_id' => $year->id, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 2000]);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $url = "/api/admin/school-years/{$year->id}/dropping-policy/periods/enrollment";
        $dates = self::periods()['enrollment'];
        $paying = [['feeId' => $fee->id, 'percent' => 100]];
        $voucher = [['feeId' => $fee->id, 'percent' => 50]];

        $this->putJson($url, $dates)->assertOk()->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.periods.enrollment', $dates)
            ->assertJsonPath('data.feeRules.paying.enrollment', [])
            ->assertJsonPath('data.feeRules.voucher_esc.enrollment', []);
        $this->putJson($url, ['feeRules' => ['paying' => $paying]])->assertOk()
            ->assertJsonPath('data.periods.enrollment', $dates);

        // A fee-only save must retain the latest shared dates, even if the
        // category editor was opened before a different admin changed them.
        $dates['startsOn'] = '2026-04-30';
        $this->putJson($url, $dates)->assertOk()
            ->assertJsonPath('data.feeRules.paying.enrollment.0.percent', 100);
        $this->putJson($url, ['feeRules' => ['voucher_esc' => $voucher]])->assertOk()
            ->assertJsonPath('data.periods.enrollment', $dates)
            ->assertJsonPath('data.feeRules.paying.enrollment.0.percent', 100)
            ->assertJsonPath('data.feeRules.voucher_esc.enrollment.0.percent', 50);

        // Date changes do not re-snapshot either category's fee names.
        $fee->update(['name' => 'New tuition name']);
        $dates['startsOn'] = '2026-04-29';
        $this->putJson($url, $dates)->assertOk()->assertJsonPath('data.version', 5)
            ->assertJsonPath('data.feeRules.paying.enrollment.0.name', 'Tuition')
            ->assertJsonPath('data.feeRules.voucher_esc.enrollment.0.name', 'Tuition');
    }

    public function test_fee_setup_can_precede_dates_and_partial_date_ranges_are_rejected(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $fee = SchoolYearFee::create(['school_year_id' => $year->id, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 2000]);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $url = "/api/admin/school-years/{$year->id}/dropping-policy/periods/quarter_1";
        $rules = ['voucher_esc' => [['feeId' => $fee->id, 'percent' => 50]]];
        $this->putJson($url, ['feeRules' => $rules])->assertOk()->assertJsonPath('data.enabled', false)
            ->assertJsonMissingPath('data.periods.quarter_1')
            ->assertJsonPath('data.feeRules.paying.quarter_1', [])
            ->assertJsonPath('data.feeRules.voucher_esc.quarter_1.0.percent', 50);
        foreach ([[], ['startsOn' => '2026-06-01'], ['endsOn' => '2026-08-31'], ['feeRules' => $rules, 'startsOn' => '2026-06-01'], ['startsOn' => '2026-08-31', 'endsOn' => '2026-06-01']] as $payload) {
            $this->putJson($url, $payload)->assertUnprocessable();
        }
        $this->assertDatabaseCount('dropping_policies', 1);
    }

    public function test_editing_one_legacy_period_preserves_other_category_formulas(): void
    {
        $year = SchoolYear::create(['school_year' => '2026-2027', 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);
        $fee = SchoolYearFee::create(['school_year_id' => $year->id, 'year_level' => 'all', 'category' => 'tuition', 'type' => 'default', 'name' => 'Tuition', 'amount' => 2000]);
        $this->actingAs(User::factory()->create(['role' => Role::Admin]));
        $url = "/api/admin/school-years/{$year->id}/dropping-policy";
        $this->putJson($url, ['enabled' => true, 'periods' => self::periods()])->assertOk();
        $this->putJson("$url/periods/enrollment", [...self::periods()['enrollment'], 'feeRules' => ['paying' => [['feeId' => $fee->id, 'percent' => 100]]]])
            ->assertOk()->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.formulas.voucher_esc.enrollment', ['registration' => 100])
            ->assertJsonMissingPath('data.feeRules.voucher_esc.enrollment')
            ->assertJsonMissingPath('data.feeRules.paying.quarter_1');
    }
}
