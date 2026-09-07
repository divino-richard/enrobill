<?php

namespace App\Http\Controllers\Admin;

use App\Actions\NotifyStudent;
use App\Actions\PromoteApplicantToStudent;
use App\Actions\ReferralLifecycle;
use App\Actions\SendApplicationDecisionEmail;
use App\Http\Controllers\Controller;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use App\Models\SchoolYear;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ApplicationController extends Controller
{
    /**
     * Statuses an admin may still accept or reject from.
     */
    private const DECIDABLE_STATUSES = ['submitted', 'under_review', 'returned'];

    /**
     * Every status an application may hold (for filtering).
     */
    private const STATUSES = ['draft', 'submitted', 'under_review', 'returned', 'accepted', 'rejected'];

    /**
     * Sortable columns, mapped from API key to database column (allow-list).
     */
    private const SORTABLE = [
        'reference' => 'reference',
        'applicantName' => 'surname',
        'yearLevel' => 'year_level',
        'schoolYear' => 'school_year',
        'status' => 'status',
        'submittedAt' => 'submitted_at',
    ];

    /**
     * Paginated, searchable, filterable, sortable list of all applications.
     * Restricted to admins by route middleware.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sort = self::SORTABLE[$request->string('sort')->value()] ?? 'created_at';
        $direction = $request->string('dir')->lower()->value() === 'asc' ? 'asc' : 'desc';
        $perPage = min(max($request->integer('per_page', 15), 1), 100);

        $applications = Application::query()
            ->with(['user', 'referral.referralCode.referrer'])
            ->when(
                in_array($request->string('status')->value(), self::STATUSES, true),
                fn ($query) => $query->where('status', $request->string('status')->value()),
            )
            ->when(
                $request->filled('school_year'),
                fn ($query) => $query->where('school_year', $request->string('school_year')->value()),
            )
            ->when(
                in_array($request->string('year_level')->value(), SchoolYear::YEAR_LEVELS, true),
                fn ($query) => $query->where('year_level', $request->string('year_level')->value()),
            )
            ->when(
                $request->filled('program_code'),
                fn ($query) => $query->where('track_or_strand', $request->string('program_code')->value()),
            )
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search')->value().'%';
                $query->where(function ($sub) use ($term) {
                    $sub->where('reference', 'like', $term)
                        ->orWhere('surname', 'like', $term)
                        ->orWhere('given_name', 'like', $term)
                        ->orWhere('email_address', 'like', $term)
                        ->orWhere('school_year', 'like', $term)
                        ->orWhere('track_or_strand', 'like', $term)
                        ->orWhereHas('user', function ($user) use ($term) {
                            $user->where('name', 'like', $term)
                                ->orWhere('email', 'like', $term);
                        });
                });
            })
            ->orderBy($sort, $direction)
            ->when(
                $sort === 'surname',
                fn ($query) => $query->orderBy('given_name', $direction),
            )
            ->orderBy('id', $direction)
            ->paginate($perPage)
            ->withQueryString();

        return ApplicationResource::collection($applications);
    }

    /**
     * A single application (admin can view any). Restricted to admins by route
     * middleware.
     */
    public function show(Application $application): ApplicationResource
    {
        return new ApplicationResource($application->load($this->applicationRelations()));
    }

    /**
     * Mark a freshly submitted application as under review — the admin has opened
     * it. Only transitions from 'submitted', so re-opening a returned or already
     * decided application is a no-op. Sends no email: this is an internal state
     * change that also clears the application from the "new" queue count.
     */
    public function review(Application $application): ApplicationResource
    {
        if ($application->status === 'submitted') {
            $application->update(['status' => 'under_review']);
        }

        return new ApplicationResource($application->load($this->applicationRelations()));
    }

    /**
     * Accept an application and notify the applicant, granting the voucher the
     * admin selected (if any). The voucher rides on the student's enrollment and is
     * applied when the cashier generates the bill — which is also what decides the
     * downpayment waiver.
     */
    public function accept(Request $request, Application $application, SendApplicationDecisionEmail $sendEmail, NotifyStudent $notify): ApplicationResource
    {
        $voucherLocked = strcasecmp(trim((string) $application->prev_school_type), 'private') === 0;

        $validated = $request->validate([
            'discountId' => [
                'bail',
                'nullable',
                'integer',
                Rule::prohibitedIf($voucherLocked),
                // Only an active voucher may be granted — not an arbitrary discount id.
                Rule::exists('discounts', 'id')->where(
                    fn ($query) => $query->where('category', 'voucher')->where('is_active', true),
                ),
            ],
        ], [
            'discountId.prohibited' => 'A voucher cannot be granted to an applicant from a private school.',
        ]);

        return $this->decide(
            $application,
            'accepted',
            $sendEmail,
            $notify,
            discountId: isset($validated['discountId']) ? (int) $validated['discountId'] : null,
            actor: $request->user(),
        );
    }

    /**
     * Reject an application, with an optional note (reason) shown to the applicant,
     * and notify them.
     */
    public function reject(Request $request, Application $application, SendApplicationDecisionEmail $sendEmail, NotifyStudent $notify): ApplicationResource
    {
        $note = $request->validate([
            'note' => ['nullable', 'string', 'max:1000'],
        ])['note'] ?? null;

        return $this->decide(
            $application,
            'rejected',
            $sendEmail,
            $notify,
            note: $note,
            actor: $request->user(),
        );
    }

    /**
     * Correct or remove a referral claim before the application is decided. The
     * existing claim is cancelled with the supplied audit reason before a corrected
     * code is attached.
     */
    public function updateReferral(Request $request, Application $application, ReferralLifecycle $referrals): ApplicationResource
    {
        abort_unless(
            in_array($application->status, self::DECIDABLE_STATUSES, true),
            422,
            'A referral can only be corrected before the application is accepted or rejected.',
        );

        $validated = $request->validate([
            'referralCode' => ['nullable', 'string', 'max:32'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $code = trim((string) ($validated['referralCode'] ?? ''));
        $code = $code !== '' ? $code : null;
        $actor = $request->user();

        DB::transaction(function () use ($application, $referrals, $code, $actor, $validated) {
            $application->loadMissing('referral.referralCode');
            $current = $application->referral?->referralCode?->code;

            if ($code === null) {
                if ($current !== null) {
                    $referrals->cancelApplication($application, $actor, $validated['reason']);
                }

                return;
            }

            if ($current !== null && strcasecmp($current, $code) !== 0) {
                $referrals->cancelApplication($application, $actor, $validated['reason']);
            }

            $referrals->syncApplication($application, $code, $actor);
        });

        return new ApplicationResource($application->fresh()->load($this->applicationRelations()));
    }

    /**
     * Move an application to a final decision and email the outcome.
     *
     * @param  'accepted'|'rejected'  $status
     */
    private function decide(
        Application $application,
        string $status,
        SendApplicationDecisionEmail $sendEmail,
        NotifyStudent $notify,
        ?string $note = null,
        ?int $discountId = null,
        ?User $actor = null,
    ): ApplicationResource {
        abort_unless(
            in_array($application->status, self::DECIDABLE_STATUSES, true),
            422,
            'This application has already been decided and cannot be changed.',
        );

        DB::transaction(function () use ($application, $status, $note, $discountId, $notify, $actor) {
            $application->update([
                'status' => $status,
                'decision_note' => $note,
            ]);

            // Once accepted, promote the applicant to a student (role flip +
            // canonical student record) and open their pending enrollment, tagged
            // with the granted voucher. Their existing token stays valid — the role
            // is read live from the database.
            if ($status === 'accepted') {
                $student = app(PromoteApplicantToStudent::class)($application, $discountId);

                if ($student === null) {
                    throw ValidationException::withMessages([
                        'application' => 'The applicant could not be promoted to a student.',
                    ]);
                }

                $enrollment = $student->enrollments()
                    ->whereHas(
                        'schoolYear',
                        fn ($query) => $query->where('school_year', $application->school_year),
                    )
                    ->first();

                if ($enrollment === null) {
                    throw ValidationException::withMessages([
                        'application' => 'The accepted application has no enrollment for its school year.',
                    ]);
                }

                $lifecycle = app(ReferralLifecycle::class);
                $wasAlreadyEnrolled = $enrollment->status === 'enrolled';
                $lifecycle->acceptApplication($application, $enrollment, $actor);

                // Defensive support for legacy/pre-existing bills: reconciliation
                // only triggers the model transition for pending enrollments, so an
                // enrollment that was already final needs the success hook explicitly.
                if ($wasAlreadyEnrolled) {
                    $lifecycle->markEnrollmentSuccessful($enrollment->fresh());
                }

                // The decision email is the only channel while they're an
                // applicant; this in-app copy is waiting for them the moment
                // they can actually see an inbox.
                if ($student !== null) {
                    $notify(
                        $student,
                        'applications',
                        'Application accepted',
                        'Congratulations — your application was accepted! Welcome aboard.',
                        ctaLabel: 'View application',
                        ctaUrl: '/portal/application',
                    );
                }
            } else {
                app(ReferralLifecycle::class)->cancelApplication(
                    $application,
                    $actor,
                    $note ?: 'Application rejected.',
                );
            }
        });

        $application->load('user');
        $sendEmail($application, $status);

        return new ApplicationResource($application->load($this->applicationRelations()));
    }

    /**
     * @return array<int, string>
     */
    private function applicationRelations(): array
    {
        return ['user', 'documents', 'referral.referralCode.referrer'];
    }
}
