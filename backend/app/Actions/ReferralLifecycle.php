<?php

namespace App\Actions;

use App\Models\Application;
use App\Models\Enrollment;
use App\Models\Freebie;
use App\Models\IncentiveAward;
use App\Models\Referral;
use App\Models\ReferralCode;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Owns every referral state transition. A claim is school-year scoped and may be
 * corrected before acceptance; earned/applied awards are never silently revoked.
 */
class ReferralLifecycle
{
    private const ELIGIBLE_STUDENT_TYPES = ['new', 'transferee'];

    public function __construct(private ReconcileEnrollmentIncentives $reconcile) {}

    /**
     * Issue (or return) the student's opaque, reusable code for a target year.
     * The student must have been an enrolled Grade 11 student in the immediately
     * preceding school year.
     */
    public function issueCode(Student $referrer, SchoolYear $targetYear, ?User $actor = null): ReferralCode
    {
        $this->assertActiveReferralCampaign($targetYear);
        $qualifyingEnrollment = $this->qualifyingPriorEnrollment($referrer, $targetYear);

        if ($qualifyingEnrollment === null) {
            throw ValidationException::withMessages([
                'referrer' => 'Only an enrolled Grade 11 student from the prior school year can receive this referral code.',
            ]);
        }

        return DB::transaction(function () use ($referrer, $targetYear, $actor, $qualifyingEnrollment) {
            $existing = ReferralCode::query()
                ->where('school_year_id', $targetYear->id)
                ->where('referrer_student_id', $referrer->id)
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                // Explicit issuance also reactivates a previously disabled code; its
                // opaque value remains stable for links already shared by the owner.
                $existing->update([
                    'qualifying_enrollment_id' => $qualifyingEnrollment->id,
                    'issued_by' => $actor?->id ?? $existing->issued_by,
                    'is_active' => true,
                ]);

                return $existing->fresh();
            }

            return ReferralCode::create([
                'school_year_id' => $targetYear->id,
                'referrer_student_id' => $referrer->id,
                'qualifying_enrollment_id' => $qualifyingEnrollment->id,
                'issued_by' => $actor?->id,
                'code' => $this->uniqueOpaqueCode(),
                'is_active' => true,
            ]);
        });
    }

    /**
     * Validate a claim without mutating it. Codes are reusable, but only for an
     * eligible Grade 11 new/transferee application in their target school year.
     */
    public function validateCode(
        string $code,
        SchoolYear $targetYear,
        ?Application $application = null,
        ?User $actor = null,
    ): ReferralCode {
        $this->assertActiveReferralCampaign($targetYear);
        $normalized = $this->normalizeCode($code);

        $referralCode = ReferralCode::query()
            ->where('code', $normalized)
            ->where('school_year_id', $targetYear->id)
            ->where('is_active', true)
            ->with(['referrer', 'qualifyingEnrollment'])
            ->first();

        if ($referralCode === null || ! $this->codeOwnerStillQualifies($referralCode, $targetYear)) {
            throw ValidationException::withMessages([
                'referralCode' => 'That referral code is invalid for this school year.',
            ]);
        }

        if ($application !== null) {
            $this->assertEligibleApplication($application, $targetYear);
        }

        // The applicant may not have a Student row yet. Application ownership (or
        // the authenticated actor before a draft exists) is the authoritative
        // identity for self-referral prevention.
        $applicantUserId = $application?->user_id ?? $actor?->id;

        if ($applicantUserId !== null && $referralCode->referrer?->user_id === $applicantUserId) {
            throw ValidationException::withMessages([
                'referralCode' => 'You cannot claim your own referral code.',
            ]);
        }

        return $referralCode;
    }

    /**
     * Create, correct, or remove an application's pre-acceptance referral claim.
     * Passing a blank code preserves an audit row by cancelling the mutable claim.
     */
    public function syncApplication(Application $application, ?string $code, ?User $actor = null): ?Referral
    {
        if (trim((string) $code) === '') {
            $this->cancelApplication($application, $actor, 'Referral code removed before acceptance.');

            return null;
        }

        $targetYear = $this->applicationSchoolYear($application);
        $referralCode = $this->validateCode((string) $code, $targetYear, $application, $actor);

        return DB::transaction(function () use ($application, $targetYear, $referralCode, $actor) {
            $referral = Referral::query()
                ->where('application_id', $application->id)
                ->lockForUpdate()
                ->first();

            if ($referral !== null && ! $referral->isMutableClaim()) {
                if ($referral->referral_code_id === $referralCode->id) {
                    return $referral;
                }

                throw ValidationException::withMessages([
                    'referralCode' => 'An accepted referral can no longer be changed.',
                ]);
            }

            $attributes = [
                'school_year_id' => $targetYear->id,
                'referral_code_id' => $referralCode->id,
                'referrer_student_id' => $referralCode->referrer_student_id,
                'status' => Referral::STATUS_CLAIMED,
                'updated_by' => $actor?->id,
                'claimed_at' => now(),
                'accepted_at' => null,
                'successful_at' => null,
            ];

            if ($referral === null) {
                // createOrFirst's unique-conflict fallback makes simultaneous
                // submissions for the same application converge on one claim.
                return Referral::query()->createOrFirst(
                    ['application_id' => $application->id],
                    ['claimed_by' => $actor?->id, ...$attributes],
                );
            }

            $referral->update($attributes);

            return $referral->fresh();
        });
    }

    /**
     * Attach the accepted applicant's Grade 11 enrollment and create their award.
     * Voucher possession is intentionally not checked here; redemption is per bill.
     */
    public function acceptApplication(
        Application $application,
        Enrollment $referredEnrollment,
        ?User $actor = null,
    ): ?Referral {
        $referral = Referral::query()->where('application_id', $application->id)->first();

        if ($referral === null || $referral->status === Referral::STATUS_CANCELLED) {
            return null;
        }

        $this->assertAcceptedEnrollmentMatches($application, $referredEnrollment, $referral);

        $accepted = DB::transaction(function () use ($referral, $referredEnrollment, $actor) {
            $referral = Referral::query()->lockForUpdate()->findOrFail($referral->id);

            if ($referral->status === Referral::STATUS_CLAIMED) {
                $referral->update([
                    'referred_student_id' => $referredEnrollment->student_id,
                    'referred_enrollment_id' => $referredEnrollment->id,
                    'status' => Referral::STATUS_ACCEPTED,
                    'accepted_by' => $actor?->id,
                    'accepted_at' => now(),
                ]);
            }

            $this->ensureReferralAward(
                referral: $referral,
                studentId: $referredEnrollment->student_id,
                enrollment: $referredEnrollment,
                beneficiary: IncentiveAward::BENEFICIARY_REFERRED_GRADE_11,
                status: IncentiveAward::STATUS_ELIGIBLE,
                qualifiedAt: $referral->accepted_at ?? now(),
            );

            return $referral->fresh();
        });

        // Usually there is no bill yet at acceptance, but this also repairs an
        // already-billed enrollment without requiring a separate operator action.
        ($this->reconcile)($referredEnrollment->fresh());

        return $accepted->fresh();
    }

    /**
     * Cancel a referral before it succeeds. An already-applied award is immutable,
     * so cancellation is rejected instead of clawing back a posted credit.
     */
    public function cancelApplication(
        Application $application,
        ?User $actor = null,
        ?string $reason = null,
    ): void {
        DB::transaction(function () use ($application, $actor, $reason) {
            $referral = Referral::query()
                ->where('application_id', $application->id)
                ->lockForUpdate()
                ->first();

            if ($referral === null || $referral->status === Referral::STATUS_CANCELLED) {
                return;
            }

            if ($referral->status === Referral::STATUS_SUCCESSFUL
                || $referral->incentiveAwards()->whereIn('status', [
                    IncentiveAward::STATUS_APPLIED,
                    IncentiveAward::STATUS_APPLIED_NO_BALANCE,
                ])->exists()) {
                throw ValidationException::withMessages([
                    'referral' => 'This referral has already earned an applied incentive and cannot be cancelled.',
                ]);
            }

            $cancelledAt = now();
            $referral->update([
                'status' => Referral::STATUS_CANCELLED,
                'updated_by' => $actor?->id,
                'cancelled_by' => $actor?->id,
                'cancellation_reason' => trim((string) $reason) ?: 'Application cancelled before referral completion.',
                'cancelled_at' => $cancelledAt,
            ]);

            $referral->incentiveAwards()
                ->whereNotIn('status', [
                    IncentiveAward::STATUS_APPLIED,
                    IncentiveAward::STATUS_APPLIED_NO_BALANCE,
                ])
                ->update([
                    'status' => IncentiveAward::STATUS_CANCELLED,
                    'cancelled_at' => $cancelledAt,
                ]);
        });
    }

    /**
     * A referral succeeds when its accepted new/transferee Grade 11 enrollment is
     * enrolled. This unlocks the referrer's one Grade 12 award for the target year.
     */
    public function markEnrollmentSuccessful(Enrollment $referredEnrollment): ?Referral
    {
        if ($referredEnrollment->year_level !== 'grade_11' || $referredEnrollment->status !== 'enrolled') {
            return null;
        }

        $referral = Referral::query()
            ->where('referred_enrollment_id', $referredEnrollment->id)
            ->whereIn('status', [Referral::STATUS_ACCEPTED, Referral::STATUS_SUCCESSFUL])
            ->first();

        if ($referral === null) {
            return null;
        }

        $successful = DB::transaction(function () use ($referral, $referredEnrollment) {
            $referral = Referral::query()->lockForUpdate()->findOrFail($referral->id);

            if ($referral->status === Referral::STATUS_ACCEPTED) {
                $referral->update([
                    'status' => Referral::STATUS_SUCCESSFUL,
                    'successful_at' => now(),
                ]);
            }

            // Ensure the referred student's acceptance award exists even when this
            // method repairs historical data whose accept hook was missed.
            $this->ensureReferralAward(
                referral: $referral,
                studentId: $referredEnrollment->student_id,
                enrollment: $referredEnrollment,
                beneficiary: IncentiveAward::BENEFICIARY_REFERRED_GRADE_11,
                status: IncentiveAward::STATUS_ELIGIBLE,
                qualifiedAt: $referral->accepted_at ?? $referral->successful_at ?? now(),
            );

            $referrerEnrollment = Enrollment::query()
                ->where('student_id', $referral->referrer_student_id)
                ->where('school_year_id', $referral->school_year_id)
                ->where('year_level', 'grade_12')
                ->first();

            if ($referrerEnrollment !== null && $referral->referrer_enrollment_id !== $referrerEnrollment->id) {
                $referral->update(['referrer_enrollment_id' => $referrerEnrollment->id]);
            }

            $this->ensureReferralAward(
                referral: $referral,
                studentId: $referral->referrer_student_id,
                enrollment: $referrerEnrollment,
                beneficiary: IncentiveAward::BENEFICIARY_REFERRER_GRADE_12,
                status: $referrerEnrollment === null
                    ? IncentiveAward::STATUS_PENDING
                    : IncentiveAward::STATUS_ELIGIBLE,
                qualifiedAt: $referral->successful_at ?? now(),
            );

            return $referral->fresh();
        });

        if ($successful->referrer_enrollment_id !== null) {
            $referrerEnrollment = Enrollment::query()->find($successful->referrer_enrollment_id);
            if ($referrerEnrollment !== null) {
                ($this->reconcile)($referrerEnrollment);
            }
        }

        return $successful;
    }

    /**
     * Attach a successful referrer's waiting award when progression creates their
     * target-year Grade 12 enrollment. Returns null when no successful referral
     * exists for this student/year.
     */
    public function attachReferrerEnrollment(Enrollment $grade12Enrollment): ?IncentiveAward
    {
        if ($grade12Enrollment->year_level !== 'grade_12') {
            return null;
        }

        $award = DB::transaction(function () use ($grade12Enrollment) {
            $referrals = Referral::query()
                ->where('school_year_id', $grade12Enrollment->school_year_id)
                ->where('referrer_student_id', $grade12Enrollment->student_id)
                ->where('status', Referral::STATUS_SUCCESSFUL)
                ->orderBy('successful_at')
                ->lockForUpdate()
                ->get();

            $qualifyingReferral = $referrals->first();
            if ($qualifyingReferral === null) {
                return null;
            }

            Referral::query()
                ->whereKey($referrals->modelKeys())
                ->whereNull('referrer_enrollment_id')
                ->update(['referrer_enrollment_id' => $grade12Enrollment->id]);

            return $this->ensureReferralAward(
                referral: $qualifyingReferral,
                studentId: $grade12Enrollment->student_id,
                enrollment: $grade12Enrollment,
                beneficiary: IncentiveAward::BENEFICIARY_REFERRER_GRADE_12,
                status: IncentiveAward::STATUS_ELIGIBLE,
                qualifiedAt: $qualifyingReferral->successful_at ?? now(),
            );
        });

        if ($award !== null) {
            ($this->reconcile)($grade12Enrollment->fresh());
        }

        return $award;
    }

    private function ensureReferralAward(
        Referral $referral,
        int $studentId,
        ?Enrollment $enrollment,
        string $beneficiary,
        string $status,
        mixed $qualifiedAt,
    ): IncentiveAward {
        $award = IncentiveAward::query()->firstOrCreate(
            [
                'school_year_id' => $referral->school_year_id,
                'student_id' => $studentId,
                'type' => IncentiveAward::TYPE_REFERRAL,
            ],
            [
                'enrollment_id' => $enrollment?->id,
                'freebie_id' => $this->freebieId($referral->school_year_id, IncentiveAward::TYPE_REFERRAL),
                'referral_id' => $referral->id,
                'beneficiary' => $beneficiary,
                'status' => $status,
                'qualified_at' => $qualifiedAt,
            ],
        );

        // Applied awards are immutable. Pending/cancelled records may be repaired or
        // reactivated by an idempotent lifecycle call before any credit is posted.
        if (! $award->isApplied()) {
            $award->update([
                'enrollment_id' => $enrollment?->id ?? $award->enrollment_id,
                'freebie_id' => $award->freebie_id
                    ?? $this->freebieId($referral->school_year_id, IncentiveAward::TYPE_REFERRAL),
                'referral_id' => $award->referral_id ?? $referral->id,
                'beneficiary' => $award->beneficiary ?: $beneficiary,
                'status' => $enrollment !== null ? IncentiveAward::STATUS_ELIGIBLE : $status,
                'qualified_at' => $award->qualified_at ?? $qualifiedAt,
                'cancelled_at' => null,
            ]);
        }

        return $award->fresh();
    }

    private function assertEligibleApplication(Application $application, SchoolYear $targetYear): void
    {
        $eligible = $application->year_level === 'grade_11'
            && in_array($application->student_type ?? 'new', self::ELIGIBLE_STUDENT_TYPES, true)
            && $application->school_year === $targetYear->school_year;

        if (! $eligible) {
            throw ValidationException::withMessages([
                'referralCode' => 'Referral codes are only for new or transferee Grade 11 applicants in the code\'s school year.',
            ]);
        }
    }

    private function assertAcceptedEnrollmentMatches(
        Application $application,
        Enrollment $enrollment,
        Referral $referral,
    ): void {
        $targetYear = SchoolYear::query()->find($referral->school_year_id);
        if ($targetYear === null) {
            throw ValidationException::withMessages(['referral' => 'The referral school year no longer exists.']);
        }

        $this->assertEligibleApplication($application, $targetYear);
        $enrollment->loadMissing('student');

        $matches = $enrollment->school_year_id === $referral->school_year_id
            && $enrollment->year_level === 'grade_11'
            && $enrollment->student?->application_id === $application->id;

        if (! $matches) {
            throw ValidationException::withMessages([
                'referral' => 'The accepted Grade 11 enrollment does not match this referral claim.',
            ]);
        }
    }

    private function applicationSchoolYear(Application $application): SchoolYear
    {
        $schoolYear = SchoolYear::query()->where('school_year', $application->school_year)->first();

        if ($schoolYear === null) {
            throw ValidationException::withMessages([
                'referralCode' => 'The application school year does not exist.',
            ]);
        }

        return $schoolYear;
    }

    private function qualifyingPriorEnrollment(Student $student, SchoolYear $targetYear): ?Enrollment
    {
        if (! preg_match('/^(\d{4})-(\d{4})$/', $targetYear->school_year, $parts)) {
            return null;
        }

        $priorLabel = ((int) $parts[1] - 1).'-'.((int) $parts[2] - 1);
        $priorYear = SchoolYear::query()->where('school_year', $priorLabel)->first();

        if ($priorYear === null) {
            return null;
        }

        return Enrollment::query()
            ->where('student_id', $student->id)
            ->where('school_year_id', $priorYear->id)
            ->where('year_level', 'grade_11')
            ->where('status', 'enrolled')
            ->first();
    }

    private function codeOwnerStillQualifies(ReferralCode $code, SchoolYear $targetYear): bool
    {
        $enrollment = $code->qualifyingEnrollment;

        return $enrollment !== null
            && $code->referrer !== null
            && $enrollment->student_id === $code->referrer_student_id
            && $enrollment->year_level === 'grade_11'
            && $enrollment->status === 'enrolled'
            && $this->qualifyingPriorEnrollment($code->referrer, $targetYear)?->id === $enrollment->id;
    }

    private function freebieId(int $schoolYearId, string $type): ?int
    {
        return Freebie::query()
            ->where('school_year_id', $schoolYearId)
            ->where('type', $type)
            ->value('id');
    }

    private function assertActiveReferralCampaign(SchoolYear $targetYear): void
    {
        if (! $targetYear->is_active || ! $targetYear->admission_open) {
            throw ValidationException::withMessages([
                'referralCode' => 'Referral codes are available only while admissions are open for the target school year.',
            ]);
        }

        $active = Freebie::query()
            ->where('school_year_id', $targetYear->id)
            ->where('type', IncentiveAward::TYPE_REFERRAL)
            ->where('is_active', true)
            ->exists();

        if (! $active) {
            throw ValidationException::withMessages([
                'referralCode' => 'The referral program is not active for this school year.',
            ]);
        }
    }

    private function normalizeCode(string $code): string
    {
        return Str::upper(trim($code));
    }

    private function uniqueOpaqueCode(): string
    {
        do {
            $code = Str::upper(Str::random(20));
        } while (ReferralCode::query()->where('code', $code)->exists());

        return $code;
    }
}
