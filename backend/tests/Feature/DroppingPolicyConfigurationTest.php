<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\SchoolYear;
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
}
