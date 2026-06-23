<?php

namespace App\Actions;

use App\Models\Enrollment;
use App\Models\Freebie;
use Illuminate\Support\Collection;

class FreebieEligibility
{
    /**
     * The active freebies (promos) an enrollment qualifies for, evaluated by type:
     *  - early_enrollment: Grade 11 enrolled within the [starts_on, ends_on] window
     *    (a null bound means open-ended).
     *  - referral: Grade 12 with enough referrals (not tracked yet → treated as 0,
     *    so it stays dormant until the referral feature lands).
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
            'referral' => $this->referralCount($enrollment) >= (int) ($freebie->min_referrals ?? 1),
            default => false,
        };
    }

    /**
     * Whether the enrollment was created on/within the freebie's window.
     */
    private function enrolledWithin(Enrollment $enrollment, Freebie $freebie): bool
    {
        $enrolledOn = $enrollment->created_at?->startOfDay();

        if ($enrolledOn === null) {
            return false;
        }

        if ($freebie->starts_on !== null && $enrolledOn->lt($freebie->starts_on->startOfDay())) {
            return false;
        }

        if ($freebie->ends_on !== null && $enrolledOn->gt($freebie->ends_on->endOfDay())) {
            return false;
        }

        return true;
    }

    /**
     * Number of students this student has referred. Not modeled yet — always 0 so
     * the referral promo stays dormant until the feature is built.
     */
    private function referralCount(Enrollment $enrollment): int
    {
        return 0;
    }
}
