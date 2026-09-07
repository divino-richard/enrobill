<?php

namespace App\Actions;

use App\Models\Enrollment;
use App\Models\Freebie;
use App\Models\IncentiveAward;
use Illuminate\Support\Collection;

class FreebieEligibility
{
    /**
     * The active freebies (promos) an enrollment qualifies for, evaluated by type:
     *  - early_enrollment: Grade 11 enrolled within the [starts_on, ends_on] window
     *    (a null bound means open-ended).
     *  - referral: either side of an earned referral award (referred Grade 11 at
     *    acceptance, referrer Grade 12 after the referral becomes successful).
     *
     * @return Collection<int, Freebie>
     */
    public function for(Enrollment $enrollment): Collection
    {
        $schoolYear = $enrollment->schoolYear;

        if ($schoolYear === null) {
            return collect();
        }

        return $schoolYear->freebies()
            ->where('is_active', true)
            ->get()
            ->filter(fn (Freebie $freebie) => $this->qualifies($enrollment, $freebie))
            ->values();
    }

    private function qualifies(Enrollment $enrollment, Freebie $freebie): bool
    {
        $requiredGrade = Freebie::GRADE_FOR_TYPE[$freebie->type] ?? null;
        if ($requiredGrade !== null && $enrollment->year_level !== $requiredGrade) {
            return false;
        }

        return match ($freebie->type) {
            'early_enrollment' => $this->enrolledWithin($enrollment, $freebie),
            // The threshold is fixed at one. ReferralLifecycle creates at most one
            // award of this type per student/school year.
            'referral' => $this->hasReferralAward($enrollment),
            default => false,
        };
    }

    /**
     * Materialize the early-enrollment award and bind earned referral awards to
     * their active school-year freebie. Voucher possession is deliberately not an
     * eligibility rule here; ReconcileEnrollmentIncentives gates each bill on its
     * own voucher.
     *
     * @return Collection<int, IncentiveAward>
     */
    public function awardsFor(Enrollment $enrollment): Collection
    {
        $enrollment->loadMissing(['student', 'schoolYear']);

        foreach ($this->for($enrollment) as $freebie) {
            if ($freebie->type === IncentiveAward::TYPE_EARLY_ENROLLMENT) {
                $this->ensureEarlyEnrollmentAward($enrollment, $freebie);

                continue;
            }

            IncentiveAward::query()
                ->where('enrollment_id', $enrollment->id)
                ->where('type', IncentiveAward::TYPE_REFERRAL)
                ->where('status', IncentiveAward::STATUS_ELIGIBLE)
                ->whereNull('freebie_id')
                ->update(['freebie_id' => $freebie->id]);
        }

        // Campaign state gates new qualification, not an award already earned.
        // Accepted/successful referrals and qualified early enrollments remain
        // redeemable if an administrator later disables the campaign.
        return IncentiveAward::query()
            ->where('enrollment_id', $enrollment->id)
            ->whereIn('status', [
                IncentiveAward::STATUS_ELIGIBLE,
                IncentiveAward::STATUS_APPLIED,
                IncentiveAward::STATUS_APPLIED_NO_BALANCE,
            ])
            ->orderBy('id')
            ->get();
    }

    /**
     * Whether the enrollment was created on/within the freebie's window.
     */
    private function enrolledWithin(Enrollment $enrollment, Freebie $freebie): bool
    {
        $enrolledOn = $enrollment->created_at?->copy()->startOfDay();

        if ($enrolledOn === null) {
            return false;
        }

        if ($freebie->starts_on !== null && $enrolledOn->lt($freebie->starts_on->copy()->startOfDay())) {
            return false;
        }

        if ($freebie->ends_on !== null && $enrolledOn->gt($freebie->ends_on->copy()->endOfDay())) {
            return false;
        }

        return true;
    }

    private function hasReferralAward(Enrollment $enrollment): bool
    {
        if (! in_array($enrollment->year_level, ['grade_11', 'grade_12'], true)) {
            return false;
        }

        return IncentiveAward::query()
            ->where('enrollment_id', $enrollment->id)
            ->where('type', IncentiveAward::TYPE_REFERRAL)
            ->whereIn('status', [
                IncentiveAward::STATUS_ELIGIBLE,
                IncentiveAward::STATUS_APPLIED,
                IncentiveAward::STATUS_APPLIED_NO_BALANCE,
            ])
            ->exists();
    }

    private function ensureEarlyEnrollmentAward(Enrollment $enrollment, Freebie $freebie): IncentiveAward
    {
        $award = IncentiveAward::query()->firstOrCreate(
            [
                'school_year_id' => $enrollment->school_year_id,
                'student_id' => $enrollment->student_id,
                'type' => IncentiveAward::TYPE_EARLY_ENROLLMENT,
            ],
            [
                'enrollment_id' => $enrollment->id,
                'freebie_id' => $freebie->id,
                'beneficiary' => IncentiveAward::BENEFICIARY_EARLY_GRADE_11,
                'status' => IncentiveAward::STATUS_ELIGIBLE,
                'qualified_at' => $enrollment->created_at ?? now(),
            ],
        );

        if (! $award->isApplied()) {
            $award->update([
                'enrollment_id' => $enrollment->id,
                'freebie_id' => $freebie->id,
                'beneficiary' => IncentiveAward::BENEFICIARY_EARLY_GRADE_11,
                'status' => IncentiveAward::STATUS_ELIGIBLE,
                'qualified_at' => $award->qualified_at ?? $enrollment->created_at ?? now(),
                'cancelled_at' => null,
            ]);
        }

        return $award->fresh();
    }
}
