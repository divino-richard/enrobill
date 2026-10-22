<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\IncentiveAward;
use App\Models\Referral;
use App\Models\ReferralCode;
use Illuminate\Validation\ValidationException;

class ReferralPaymentGuard
{
    /** @return array{reason: string, message: string, cutoff: ?string}|null */
    public function forBill(Bill $bill): ?array
    {
        if ($bill->balance() <= 0 || $bill->isDroppingBill()
            || $bill->enrollment?->year_level !== 'grade_12' || ! $bill->hasActiveVoucher()) {
            return null;
        }

        // The benefit is earned once per school year. Further pending applicants
        // must not put a bill back on hold after that benefit has been applied.
        if (IncentiveAward::where('enrollment_id', $bill->enrollment_id)
            ->where('type', IncentiveAward::TYPE_REFERRAL)
            ->where('beneficiary', IncentiveAward::BENEFICIARY_REFERRER_GRADE_12)
            ->whereIn('status', [IncentiveAward::STATUS_APPLIED, IncentiveAward::STATUS_APPLIED_NO_BALANCE])
            ->exists()) {
            return null;
        }

        $earned = Referral::where('referrer_student_id', $bill->student_id)
            ->where('school_year_id', $bill->school_year_id)
            ->where('status', Referral::STATUS_SUCCESSFUL)->exists();
        $participates = ReferralCode::where('referrer_student_id', $bill->student_id)
            ->where('school_year_id', $bill->school_year_id)->exists();
        $period = app(ReferralPeriod::class);
        $cutoff = $period->closesAt($bill->school_year_id);
        if (! $earned && (! $participates || $period->hasEnded($bill->school_year_id))) {
            return null;
        }

        return [
            'reason' => $earned ? 'referral_credit_pending' : 'referral_pending',
            'cutoff' => $cutoff?->toDateString(),
            'message' => $earned
                ? 'Your referral qualified. Payments stay paused while the benefit is applied to your bill.'
                : ($cutoff === null
                    ? 'Payments are paused while the school sets the referral cutoff. Contact the registrar for an update.'
                    : 'Your benefit applies when a referred student enrolls. If no referral qualifies by the cutoff, payments resume.'),
        ];
    }

    /** Call inside the payment transaction, after locking the student and bill. */
    public function assertCanPay(Bill $bill): void
    {
        $guard = $this->forBill($bill);
        if ($guard !== null) {
            throw ValidationException::withMessages(['payment' => $guard['message']]);
        }
    }
}
