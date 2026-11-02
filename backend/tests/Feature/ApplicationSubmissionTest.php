<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Http\Controllers\Admin\ApplicationController;
use App\Models\Application;
use App\Models\Program;
use App\Models\SchoolYear;
use App\Models\User;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ApplicationSubmissionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        SchoolYear::create([
            'fees_published_at' => now(),
            'school_year' => '2026-2027',
            'start_date' => '2026-06-01',
            'end_date' => '2027-03-31',
            'is_active' => true,
            'admission_open' => true,
            'downpayment_value' => 100,
            'installment_count' => 4,
        ]);
        Program::firstOrCreate(['code' => 'gas'], ['name' => 'General Academic Strand', 'category' => 'academic']);
    }

    public static function editableStatuses(): array
    {
        return [['draft'], ['returned'], ['rejected']];
    }

    #[DataProvider('editableStatuses')]
    public function test_applicants_can_submit_their_draft_or_corrected_application(string $status): void
    {
        $application = $this->createApplicantApplication($status);
        $application->documents()->create([
            'type' => 'report_card_tor', 's3_key' => 'old-report.pdf', 'file_name' => 'old-report.pdf',
        ]);
        $payload = $this->payload();
        $payload['schoolYear'] = '2025-2026';
        $payload['documents'] = [
            ['type' => 'report_card_tor', 'key' => 'new-report.pdf', 'fileName' => 'new-report.pdf'],
        ];

        $this->actingAs($application->user)->putJson("/api/applications/{$application->id}", $payload)
            ->assertOk()
            ->assertJsonPath('data.id', $application->id)
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.schoolYear', '2026-2027')
            ->assertJsonPath('data.values.givenName', 'Updated');

        $this->assertDatabaseCount('applications', 1);
        $this->assertNotNull($application->fresh()->submitted_at);
        $this->assertSame(['new-report.pdf'], $application->documents()->pluck('s3_key')->all());
    }

    public static function lockedStatuses(): array
    {
        return [['submitted'], ['under_review'], ['accepted']];
    }

    #[DataProvider('lockedStatuses')]
    public function test_applications_in_review_or_accepted_cannot_be_edited(string $status): void
    {
        $application = $this->createApplicantApplication($status);

        $this->actingAs($application->user)->putJson("/api/applications/{$application->id}", $this->payload())
            ->assertForbidden();

        $this->assertSame($status, $application->fresh()->status);
        $this->assertSame('Original', $application->fresh()->given_name);
    }

    public function test_another_applicant_cannot_edit_the_application(): void
    {
        $application = $this->createApplicantApplication('returned');
        $otherUser = User::factory()->create(['role' => Role::Applicant]);

        $this->actingAs($otherUser)->putJson("/api/applications/{$application->id}", $this->payload())
            ->assertNotFound();
        $this->assertSame('returned', $application->fresh()->status);
    }

    public function test_acceptance_during_resubmission_cannot_be_overwritten(): void
    {
        $application = $this->createApplicantApplication('returned');
        $accepted = false;
        Event::listen(TransactionBeginning::class, function () use ($application, &$accepted) {
            if (! $accepted) {
                $accepted = true;
                Application::whereKey($application->id)->update(['status' => 'accepted']);
            }
        });

        $this->actingAs($application->user)->putJson("/api/applications/{$application->id}", $this->payload())
            ->assertForbidden();

        $this->assertTrue($accepted);
        $this->assertSame('Original', $application->fresh()->given_name);
    }

    public function test_opening_a_stale_application_cannot_replace_its_accepted_status(): void
    {
        $application = $this->createApplicantApplication('submitted');
        Application::whereKey($application->id)->update(['status' => 'accepted']);

        app(ApplicationController::class)->review($application);

        $this->assertSame('accepted', $application->fresh()->status);
    }

    public function test_closed_admissions_prevent_submission(): void
    {
        $application = $this->createApplicantApplication('draft');
        SchoolYear::query()->update(['admission_open' => false]);

        $this->actingAs($application->user)->putJson("/api/applications/{$application->id}", $this->payload())
            ->assertUnprocessable();
        $this->assertSame('draft', $application->fresh()->status);
    }

    public static function conflictingStatuses(): array
    {
        return [['accepted'], ['draft'], ['submitted'], ['under_review'], ['returned']];
    }

    #[DataProvider('conflictingStatuses')]
    public function test_another_active_or_accepted_application_prevents_submission(string $status): void
    {
        $application = $this->createApplicantApplication('returned');
        $this->createApplicantApplication($status, $application->user);

        $this->actingAs($application->user)->putJson("/api/applications/{$application->id}", $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('application');
        $this->assertSame('returned', $application->fresh()->status);
    }

    public function test_invalid_corrections_leave_the_application_unchanged(): void
    {
        $application = $this->createApplicantApplication('returned');
        $payload = $this->payload();
        $payload['agreementAccepted'] = false;

        $this->actingAs($application->user)->putJson("/api/applications/{$application->id}", $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('agreementAccepted');
        $this->assertSame('returned', $application->fresh()->status);
        $this->assertSame('Original', $application->fresh()->given_name);
    }

    private function createApplicantApplication(string $status, ?User $user = null): Application
    {
        $user ??= User::factory()->create(['role' => Role::Applicant]);

        return Application::create([
            'user_id' => $user->id,
            'reference' => 'APP-'.Str::upper(Str::random(12)),
            'status' => $status,
            'enrollment_type' => 'freshman',
            'surname' => 'Applicant',
            'given_name' => 'Original',
            'track_or_strand' => 'gas',
            'year_level' => 'grade_11',
            'school_year' => '2026-2027',
        ]);
    }

    public static function submissionModes(): array
    {
        return [['post'], ['put']];
    }

    #[DataProvider('submissionModes')]
    public function test_withdrawing_fees_during_submission_prevents_using_a_stale_open_year(string $method): void
    {
        $application = $this->createApplicantApplication('rejected');
        $withdrawn = false;
        Event::listen(TransactionBeginning::class, function () use (&$withdrawn) {
            if (! $withdrawn) {
                $withdrawn = true;
                SchoolYear::query()->update(['fees_published_at' => null, 'admission_open' => false]);
            }
        });
        $this->actingAs($application->user)->json(strtoupper($method),
            $method === 'post' ? '/api/applications' : "/api/applications/{$application->id}", $this->payload())
            ->assertUnprocessable();
        $this->assertDatabaseCount('applications', 1);
        $this->assertSame('rejected', $application->fresh()->status);
    }

    private function payload(): array
    {
        return [
            'surname' => 'Applicant', 'givenName' => 'Updated', 'dateOfBirth' => '2008-01-01',
            'gender' => 'female', 'phoneNumber' => '09123456789', 'guardianContactNumber' => '09987654321',
            'trackOrStrand' => 'gas', 'yearLevel' => 'grade_11', 'schoolYear' => '2026-2027',
            'agreementAccepted' => true, 'studentType' => 'continuing', 'documents' => [],
        ];
    }
}
