<?php

namespace App\Services;

use App\Models\Freebie;
use App\Models\Referral;
use Carbon\CarbonImmutable;

class ReferralPeriod
{
    public const TIMEZONE = 'Asia/Manila';

    public function campaign(int $schoolYearId): ?Freebie
    {
        return Freebie::where('school_year_id', $schoolYearId)->where('type', 'referral')->first();
    }

    public function closesAt(int $schoolYearId): ?CarbonImmutable
    {
        $date = $this->campaign($schoolYearId)?->ends_on?->toDateString();

        return $date ? CarbonImmutable::parse($date, self::TIMEZONE)->endOfDay() : null;
    }

    public function hasEnded(int $schoolYearId): bool
    {
        $cutoff = $this->closesAt($schoolYearId);

        return $cutoff !== null && now()->gt($cutoff);
    }

    /** Expiry is derived, so collection never depends on a scheduled job running. */
    public function status(Referral $referral): string
    {
        if (in_array($referral->status, [Referral::STATUS_CLAIMED, Referral::STATUS_ACCEPTED], true)
            && $this->hasEnded($referral->school_year_id)) {
            return 'expired';
        }

        return $referral->status;
    }
}
