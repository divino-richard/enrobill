<?php

namespace Tests\Feature;

use App\Actions\YearEndCloseout;
use App\Enums\Role;
use App\Models\Bill;
use App\Models\DroppingPolicy;
use App\Models\DroppingRequest;
use App\Models\Enrollment;
use App\Models\ProgressionDecision;
use App\Models\SchoolYear;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DroppingRequestTest extends TestCase
{
    use RefreshDatabase;

    private function enrollment(): Enrollment
    {
        $user = User::factory()->create(['role' => Role::Student]);
        $student = Student::create(['user_id' => $user->id, 'student_number' => 'S-'.$user->id, 'status' => 'enrolled', 'first_name' => 'Test', 'last_name' => 'Student']);
        $year = SchoolYear::firstOrCreate(['school_year' => '2026-2027'], ['is_active' => true, 'start_date' => '2026-06-01', 'end_date' => '2027-03-31']);

        return Enrollment::create(['student_id' => $student->id, 'school_year_id' => $year->id, 'track' => 'stem', 'year_level' => 'grade_11', 'status' => 'enrolled', 'enrolled_at' => now()->subDays(30)]);
    }

    private function draft(Enrollment $e): int
    {
        // Legacy drafts remain editable, but opening the new form never creates one.
        $this->actingAs($e->student->user);

        return DroppingRequest::create([
            'student_id' => $e->student_id, 'enrollment_id' => $e->id, 'active_enrollment_id' => $e->id,
            'status' => 'draft', 'submissions' => [], 'events' => [],
            'snapshot' => ['studentName' => 'Test Student', 'studentNumber' => $e->student->student_number,
                'schoolYear' => $e->schoolYear->school_year, 'program' => $e->track, 'yearLevel' => $e->year_level],
        ])->id;
    }

    private function packet(int $id): void
    {
        Storage::fake('s3');
        $this->post('/api/me/dropping-requests/'.$id.'/submit', [
            'reason' => 'Family circumstances',
            'files' => [UploadedFile::fake()->create('signed-form.pdf', 20, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.status', 'submitted');
    }

    public function test_starting_without_a_complete_submission_creates_no_draft(): void
    {
        Storage::fake('s3');
        $e = $this->enrollment();
        $this->actingAs($e->student->user)->getJson('/api/me/dropping-requests')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/me/dropping-requests', ['enrollmentId' => $e->id])->assertUnprocessable()->assertJsonValidationErrors(['reason', 'files']);
        $this->post('/api/me/dropping-requests', [
            'enrollmentId' => $e->id, 'reason' => 'Reason',
            'files' => [UploadedFile::fake()->create('script.html', 10, 'text/html')],
        ], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertDatabaseCount('dropping_requests', 0);
        $this->assertEmpty(Storage::disk('s3')->allFiles());
        $this->assertSame('enrolled', $e->fresh()->status);
    }

    public function test_submission_creates_one_complete_request_and_retries_do_not_duplicate_it(): void
    {
        Storage::fake('s3');
        $e = $this->enrollment();
        $this->actingAs($e->student->user);
        $payload = fn () => ['enrollmentId' => $e->id, 'reason' => 'Family circumstances',
            'files' => [UploadedFile::fake()->create('signed-form.pdf', 20, 'application/pdf')]];
        $id = $this->post('/api/me/dropping-requests', $payload(), ['Accept' => 'application/json'])
            ->assertSuccessful()->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.packetVersion', 1)->assertJsonPath('data.reason', 'Family circumstances')
            ->assertJsonCount(1, 'data.submissions.0.files')->json('data.id');
        $this->post('/api/me/dropping-requests', $payload(), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.id', $id)->assertJsonPath('data.packetVersion', 1);
        $this->assertDatabaseCount('dropping_requests', 1);
        $this->assertDatabaseCount('student_notifications', 1);
        $this->assertCount(1, Storage::disk('s3')->allFiles());
        $this->assertSame(['submitted'], array_column(DroppingRequest::findOrFail($id)->events, 'action'));
        $this->assertSame('enrolled', $e->fresh()->status);
    }

    public function test_new_submission_respects_existing_legacy_requests_without_overwriting_them(): void
    {
        Storage::fake('s3');
        $e = $this->enrollment();
        $id = $this->draft($e);
        $this->post('/api/me/dropping-requests', [
            'enrollmentId' => $e->id, 'reason' => 'New reason',
            'files' => [UploadedFile::fake()->create('signed-form.pdf', 20, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.id', $id)->assertJsonPath('data.status', 'draft');
        $this->assertDatabaseCount('dropping_requests', 1);
        $this->assertEmpty(Storage::disk('s3')->allFiles());
        $this->packet($id);
    }

    public function test_failed_upload_rolls_back_the_request_and_removes_already_stored_files(): void
    {
        Storage::fake('s3');
        $disk = Storage::disk('s3');
        $e = $this->enrollment();
        $valid = UploadedFile::fake()->create('signed-form.pdf', 20, 'application/pdf');
        $failed = \Mockery::mock(UploadedFile::fake()->create('attachment.pdf', 20, 'application/pdf'))->makePartial();
        $failed->shouldReceive('store')->once()->andReturn(false);
        $this->actingAs($e->student->user)->post('/api/me/dropping-requests', [
            'enrollmentId' => $e->id, 'reason' => 'Reason', 'files' => [$valid, $failed],
        ], ['Accept' => 'application/json'])->assertStatus(503);
        $this->assertDatabaseCount('dropping_requests', 0);
        $this->assertDatabaseCount('student_notifications', 0);
        $this->assertEmpty($disk->allFiles());
    }

    public function test_new_submission_requires_own_active_enrollment(): void
    {
        Storage::fake('s3');
        $e = $this->enrollment();
        $other = $this->enrollment();
        $this->actingAs($e->student->user);
        $payload = fn ($id) => ['enrollmentId' => $id, 'reason' => 'Reason',
            'files' => [UploadedFile::fake()->create('signed-form.pdf', 20, 'application/pdf')]];
        $this->post('/api/me/dropping-requests', $payload($other->id), ['Accept' => 'application/json'])->assertNotFound();
        $e->update(['status' => 'dropped']);
        $this->post('/api/me/dropping-requests', $payload($e->id), ['Accept' => 'application/json'])->assertUnprocessable();
        $inactive = $this->enrollment();
        $this->actingAs($inactive->student->user);
        $inactive->schoolYear->update(['is_active' => false]);
        $this->post('/api/me/dropping-requests', $payload($inactive->id), ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertDatabaseCount('dropping_requests', 0);
        $this->assertEmpty(Storage::disk('s3')->allFiles());
    }

    public function test_complete_flow_preserves_finances_and_history_and_is_idempotent(): void
    {
        $this->travelTo(Carbon::parse('2026-09-23 22:00:00', 'UTC'));
        $e = $this->enrollment();
        $section = Section::create(['school_year_id' => $e->school_year_id, 'program' => 'stem', 'year_level' => 'grade_11', 'name' => 'A', 'capacity' => 30]);
        $e->update(['section_id' => $section->id]);
        $bill = Bill::create(['student_id' => $e->student_id, 'enrollment_id' => $e->id, 'school_year_id' => $e->school_year_id, 'total' => 1000, 'amount_paid' => 100, 'status' => 'partial']);
        $bill->items()->create(['name' => 'Tuition', 'category' => 'tuition', 'dropping_component' => 'tuition', 'amount' => 1000]);
        $bill->payments()->create(['amount' => 100, 'method' => 'cash', 'status' => 'verified', 'paid_at' => now()]);
        $bill->installments()->create(['label' => 'Payment', 'amount' => 1000, 'due_date' => '2026-10-01', 'sequence' => 1]);
        $e->update(['dropping_category' => 'paying']);
        DroppingPolicy::create(['school_year_id' => $e->school_year_id, 'version' => 1, 'enabled' => true, 'periods' => DroppingPolicyConfigurationTest::periods()]);
        $originalItems = $bill->items->toArray();
        ProgressionDecision::create(['student_id' => $e->student_id, 'from_school_year_id' => $e->school_year_id, 'decision' => 'retain', 'from_year_level' => 'grade_11', 'to_year_level' => 'grade_11', 'decided_at' => now()]);
        Storage::fake('s3');
        $id = $this->actingAs($e->student->user)->post('/api/me/dropping-requests', [
            'enrollmentId' => $e->id, 'reason' => 'Family circumstances',
            'files' => [UploadedFile::fake()->create('signed-form.pdf', 20, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertSuccessful()->assertJsonPath('data.status', 'submitted')->json('data.id');
        $this->assertSame('enrolled', $e->fresh()->status);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $this->actingAs($cashier)->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now('Asia/Manila')->toDateString()])->assertForbidden();
        $preview = $this->actingAs($admin)->getJson("/api/dropping-requests/$id/assessment?effectiveDate=".now('Asia/Manila')->toDateString())
            ->assertOk()->assertJsonPath('data.ready', true)->json('data');
        $this->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now('Asia/Manila')->toDateString(), 'assessmentFingerprint' => $preview['fingerprint']])->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now('Asia/Manila')->toDateString()])->assertOk();
        $this->assertSame('dropped', $e->fresh()->status);
        $this->assertSame($section->id, $e->fresh()->section_id);
        $this->assertEquals($originalItems, $bill->fresh()->items->toArray());
        $this->assertEquals(500, $bill->fresh()->netTotal());
        $this->assertEquals(100, $bill->fresh()->amount_paid);
        $this->assertEquals(400, $bill->fresh()->balance());
        $this->assertDatabaseCount('dropping_assessments', 1);
        $this->assertSame(1, StudentNotification::where('student_id', $e->student_id)->where('message', 'like', 'Your dropping request is approved%')->count());
        $this->putJson('/api/admin/enrollments/'.$e->id, ['status' => 'enrolled'])->assertStatus(422);
        $this->assertFalse(app(YearEndCloseout::class)->pendingStudents($e->schoolYear)->contains('id', $e->student_id));
        $nextYear = SchoolYear::create(['school_year' => '2027-2028', 'is_active' => false, 'start_date' => '2027-06-01', 'end_date' => '2028-03-31']);
        $this->assertSame(0, app(YearEndCloseout::class)->materialize($e->schoolYear, $admin->id));
        $this->actingAs($cashier)->postJson("/api/admin/bills/$bill->id/payments", ['amount' => 400, 'method' => 'cash', 'paidAt' => '2026-09-24'])->assertSuccessful();
        $this->actingAs($admin);
        Enrollment::create(['student_id' => $e->student_id, 'school_year_id' => $nextYear->id, 'track' => 'stem', 'year_level' => 'grade_11', 'status' => 'pending']);
        $e->student->fresh()->syncStatusFromLatestEnrollment();
        $this->assertSame('admitted', $e->student->fresh()->status);
        $this->assertSame('dropped', $e->fresh()->status);
        $this->getJson('/api/admin/sections')->assertJsonPath('data.0.assignedCount', 0);
        $this->deleteJson('/api/admin/sections/'.$section->id)->assertUnprocessable();
        $this->putJson('/api/admin/enrollments/'.$e->id.'/section', ['sectionId' => null])->assertUnprocessable();
        $this->assertSame($section->id, $e->fresh()->section_id);
        $this->actingAs($e->student->user)->get("/api/dropping-requests/$id/acknowledgment")->assertOk();
        $this->postJson("/api/me/dropping-requests/$id/cancel")->assertStatus(422);
    }

    public function test_ownership_and_direct_status_bypass_are_blocked(): void
    {
        $e = $this->enrollment();
        $id = $this->draft($e);
        $other = $this->enrollment();
        $this->actingAs($other->student->user)->getJson("/api/dropping-requests/$id")->assertNotFound();
        $this->postJson("/api/me/dropping-requests/$id/cancel")->assertNotFound();
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin)->putJson('/api/admin/enrollments/'.$e->id, ['status' => 'dropped'])->assertStatus(422);
        $this->assertSame('enrolled', $e->fresh()->status);
    }

    public function test_corrections_preserve_documents_and_block_stale_approval(): void
    {
        $e = $this->enrollment();
        $id = $this->draft($e);
        $this->packet($id);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin)->postJson("/api/admin/dropping-requests/$id/decision", ['version' => 1, 'outcome' => 'needs_correction', 'remarks' => 'Replace the blurry signature page'])->assertOk();
        $before = DroppingRequest::findOrFail($id)->submissions;
        $this->actingAs($e->student->user)->post("/api/me/dropping-requests/$id/submit", ['reason' => 'Updated reason', 'files' => [UploadedFile::fake()->create('clear-form.pdf', 10, 'application/pdf')]], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonCount(2, 'data.submissions')->assertJsonMissingPath('data.documentsVerifiedAt')->assertJsonMissingPath('data.financeOutcome');
        $this->assertEquals($before[0], DroppingRequest::findOrFail($id)->submissions[0]);
        $this->actingAs($admin)->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now()->toDateString()])->assertStatus(409);
        $this->postJson("/api/admin/dropping-requests/$id/decision", ['version' => 2, 'outcome' => 'needs_correction', 'remarks' => ''])->assertStatus(422);
        $this->assertSame('enrolled', $e->fresh()->status);
    }

    public function test_files_and_actions_are_scoped_and_closed_requests_are_immutable(): void
    {
        $e = $this->enrollment();
        $id = $this->draft($e);
        $this->packet($id);
        $fileId = DroppingRequest::findOrFail($id)->submissions[0]['files'][0]['id'];
        $this->get("/api/dropping-requests/$id/files/$fileId")->assertOk();
        $this->get("/api/dropping-requests/$id/acknowledgment")->assertStatus(422);
        $other = $this->enrollment();
        $this->actingAs($other->student->user)->get("/api/dropping-requests/$id/files/$fileId")->assertNotFound();
        $cashier = User::factory()->create(['role' => Role::Cashier]);
        $this->actingAs($cashier)->get("/api/dropping-requests/$id/files/$fileId")->assertForbidden();
        $this->getJson("/api/dropping-requests/$id")->assertForbidden();
        $this->postJson("/api/admin/dropping-requests/$id/confirm", [])->assertForbidden();
        $teacher = User::factory()->create(['role' => Role::Teacher]);
        $this->actingAs($teacher)->getJson("/api/dropping-requests/$id")->assertForbidden();
        $this->actingAs($e->student->user)->postJson("/api/me/dropping-requests/$id/cancel")->assertOk();
        $this->post("/api/me/dropping-requests/$id/submit", ['reason' => 'Retry', 'files' => [UploadedFile::fake()->create('form.pdf', 10, 'application/pdf')]], ['Accept' => 'application/json'])->assertStatus(422);
        $this->assertSame('enrolled', $e->fresh()->status);
        $newId = $this->draft($e);
        $this->assertNotEquals($id, $newId);
    }

    public function test_approval_requires_submission_and_valid_date_and_removed_review_routes_are_absent(): void
    {
        $e = $this->enrollment();
        $id = $this->draft($e);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin)->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now()->toDateString()])->assertStatus(422);
        $this->actingAs($e->student->user);
        $this->packet($id);
        $this->actingAs($admin)->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now()->addDays(2)->toDateString()])->assertStatus(422);
        $this->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now()->subDays(60)->toDateString()])->assertStatus(422);
        foreach (['documents', 'finance', 'review'] as $action) {
            $this->postJson("/api/admin/dropping-requests/$id/$action", [])->assertNotFound();
        }
        $this->assertSame('enrolled', $e->fresh()->status);
    }

    public function test_simplification_migration_preserves_requests_and_removes_review_columns(): void
    {
        $e = $this->enrollment();
        $id = $this->draft($e);
        $this->packet($id);
        $before = DroppingRequest::findOrFail($id)->submissions;
        $migration = require database_path('migrations/2026_09_25_000000_simplify_dropping_requests.php');
        $migration->down();
        DB::table('dropping_requests')->where('id', $id)->update(['status' => 'under_review', 'finance_outcome' => 'needs_resolution']);
        $migration->up();
        $this->assertSame('submitted', DroppingRequest::findOrFail($id)->status);
        $this->assertEquals($before, DroppingRequest::findOrFail($id)->submissions);
        foreach (['checklist', 'documents_verified_by', 'documents_verified_at', 'finance_outcome', 'finance_remarks', 'reviewed_balance', 'finance_reviewed_by', 'finance_reviewed_at'] as $column) {
            $this->assertFalse(Schema::hasColumn('dropping_requests', $column));
        }
    }

    public function test_rejection_and_invalid_uploads_do_not_change_enrollment(): void
    {
        $e = $this->enrollment();
        $id = $this->draft($e);
        $this->post("/api/me/dropping-requests/$id/submit", ['reason' => 'Reason', 'files' => [UploadedFile::fake()->create('script.html', 10, 'text/html')]], ['Accept' => 'application/json'])->assertStatus(422);
        $this->post("/api/me/dropping-requests/$id/submit", ['reason' => 'Reason', 'files' => [UploadedFile::fake()->create('big.pdf', 2049, 'application/pdf')]], ['Accept' => 'application/json'])->assertStatus(422);
        $this->packet($id);
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin)->postJson("/api/admin/dropping-requests/$id/decision", ['version' => 1, 'outcome' => 'rejected', 'remarks' => 'Wrong enrollment'])->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->postJson("/api/admin/dropping-requests/$id/confirm", ['version' => 1, 'effectiveDate' => now()->toDateString()])->assertStatus(422);
        $this->assertSame('enrolled', $e->fresh()->status);
    }
}
