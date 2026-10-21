<?php

namespace Tests\Feature;

use App\Actions\YearEndCloseout;
use App\Enums\Role;
use App\Models\Enrollment;
use App\Models\SchoolYear;
use App\Models\SemesterStanding;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProgressionRolloverTest extends TestCase
{
    use RefreshDatabase;

    private function promotedStudent(): array
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $user = User::factory()->create(['role' => Role::Student]);
        $old = SchoolYear::create(['school_year' => '2026-2027', 'is_active' => true, 'progression_open' => true]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'ROLLOVER-1',
            'first_name' => 'Promoted', 'last_name' => 'Student', 'status' => 'enrolled',
            'track_or_strand' => 'gas', 'year_level' => 'grade_11', 'school_year' => '2026-2027']);
        $source = Enrollment::create(['student_id' => $student->id, 'school_year_id' => $old->id,
            'track' => 'gas', 'year_level' => 'grade_11', 'status' => 'enrolled', 'enrolled_at' => now()]);
        foreach (['first', 'second'] as $semester) {
            SemesterStanding::create(['student_id' => $student->id, 'school_year_id' => $old->id,
                'semester' => $semester, 'clearance_cleared' => true, 'grades_passed' => true]);
        }
        app(YearEndCloseout::class)->decide($old, [$student->id], 'promote', $admin->id);
        $old->update(['is_active' => false, 'progression_open' => null]);
        $active = SchoolYear::create(['school_year' => '2027-2028', 'is_active' => true, 'progression_open' => false]);

        return compact('admin', 'user', 'student', 'old', 'active', 'source');
    }

    public function test_portal_distinguishes_a_promotion_from_a_created_enrollment(): void
    {
        extract($this->promotedStudent());
        $this->actingAs($user)->getJson('/api/me/student')->assertOk()
            ->assertJsonPath('data.yearLevel', 'grade_12')
            ->assertJsonPath('meta.activeSchoolYear', '2027-2028')
            ->assertJsonPath('meta.pendingProgression.decision', 'promote')
            ->assertJsonPath('meta.pendingProgression.schoolYear', '2027-2028');
        $this->getJson('/api/me/enrollments')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.yearLevel', 'grade_11')->assertJsonPath('data.0.isCurrent', false);
        $this->assertSame(1, $student->enrollments()->count());
    }

    public function test_prior_year_enrollment_step_remains_available_after_activation(): void
    {
        extract($this->promotedStudent());
        $this->actingAs($admin)->getJson('/api/admin/progression')->assertOk()
            ->assertJsonPath('data.progressionOpen', false)
            ->assertJsonPath('data.carryForward.sourceYear.id', $old->id)
            ->assertJsonPath('data.carryForward.targetYear.id', $active->id)
            ->assertJsonPath('data.carryForward.count', 1);
        $this->postJson('/api/admin/progression/materialize', ['sourceSchoolYearId' => $old->id])
            ->assertOk()->assertJsonPath('data.materialized', 1);
        $this->postJson('/api/admin/progression/materialize', ['sourceSchoolYearId' => $old->id])
            ->assertOk()->assertJsonPath('data.materialized', 0);
        $this->assertDatabaseHas('enrollments', ['student_id' => $student->id,
            'school_year_id' => $active->id, 'year_level' => 'grade_12', 'status' => 'pending']);
        $this->assertSame('grade_11', $source->fresh()->year_level);
        $this->actingAs($user)->getJson('/api/me/enrollments')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.isCurrent', true)->assertJsonPath('data.0.status', 'pending')
            ->assertJsonPath('data.1.isCurrent', false);
        $this->getJson('/api/me/student')->assertOk()->assertJsonPath('meta.pendingProgression', null);
    }

    public function test_recovery_cannot_bypass_the_active_year_window_or_student_permissions(): void
    {
        extract($this->promotedStudent());
        $this->actingAs($admin)->postJson('/api/admin/progression/materialize', ['sourceSchoolYearId' => $active->id])->assertUnprocessable();
        $this->postJson('/api/admin/progression/materialize')->assertUnprocessable();
        $this->actingAs($user)->postJson('/api/admin/progression/materialize', ['sourceSchoolYearId' => $old->id])->assertForbidden();
        $this->assertSame(1, $student->enrollments()->count());
    }

    public function test_a_dropped_source_is_not_offered_or_carried_forward(): void
    {
        extract($this->promotedStudent());
        $source->update(['status' => 'dropped']);
        $this->actingAs($admin)->getJson('/api/admin/progression')->assertOk()->assertJsonPath('data.carryForward', null);
        $this->postJson('/api/admin/progression/materialize', ['sourceSchoolYearId' => $old->id])
            ->assertOk()->assertJsonPath('data.materialized', 0);
        $this->actingAs($user)->getJson('/api/me/student')->assertOk()->assertJsonPath('meta.pendingProgression', null);
        $this->assertSame(1, $student->enrollments()->count());
    }
}
