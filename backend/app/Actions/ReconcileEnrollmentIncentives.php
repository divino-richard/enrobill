<?php

namespace App\Actions;

use App\Models\Bill;
use App\Models\BillAdjustment;
use App\Models\Enrollment;
use App\Models\Freebie;
use App\Models\IncentiveAward;
use Illuminate\Support\Facades\DB;

/**
 * Posts at most one zero-tuition credit to an enrollment's bill and attaches all
 * independently-earned awards to it. Safe to call after acceptance, progression,
 * bill generation, payment verification, or referral success.
 */
class ReconcileEnrollmentIncentives
{
    public const LABEL = 'Zero Tuition Incentive';

    public function __construct(
        private FreebieEligibility $eligibility,
        private GenerateInstallmentSchedule $generateSchedule,
        private NotifyStudent $notify,
    ) {}

    public function __invoke(Enrollment $enrollment): ?BillAdjustment
    {
        return DB::transaction(function () use ($enrollment) {
            $enrollment = Enrollment::query()
                ->whereKey($enrollment->id)
                ->with(['student', 'schoolYear'])
                ->lockForUpdate()
                ->first();

            if ($enrollment === null) {
                return null;
            }

            $bill = Bill::query()
                ->where('enrollment_id', $enrollment->id)
                ->with(['student', 'schoolYear', 'enrollment', 'adjustments', 'installments'])
                ->lockForUpdate()
                ->first();

            if ($bill === null) {
                return null;
            }

            $awards = $this->eligibility->awardsFor($enrollment);
            $existing = $bill->adjustments()
                ->where('incentive_key', BillAdjustment::INCENTIVE_KEY_ZERO_TUITION)
                ->first();

            // Adopt a touched pre-ledger early-enrollment credit in place. This is
            // deliberately not a bulk backfill, and the label match avoids treating
            // arbitrary null-discount adjustments as incentives.
            $existing ??= $this->adoptLegacyEarlyAdjustment($bill, $enrollment);

            $unapplied = $awards->where('status', IncentiveAward::STATUS_ELIGIBLE);
            if ($unapplied->isEmpty() && $existing === null) {
                return $existing;
            }

            $baseNet = round(max(
                (float) $bill->total - (float) $bill->adjustments()
                    ->whereNull('incentive_key')
                    ->sum('amount'),
                0,
            ), 2);
            $verifiedPayments = round((float) $bill->payments()
                ->where('status', 'verified')
                ->sum('amount'), 2);

            // A late award only removes what is still owed. Money already paid
            // remains paid and is never converted into a refund/negative balance.
            $credit = round(max($baseNet - $verifiedPayments, 0), 2);

            $adjustment = $existing;
            $changed = false;

            if ($adjustment !== null) {
                // Ordinary adjustments can be added or removed after the incentive;
                // keep the shared credit equal to the unpaid base net without ever
                // changing the immutable award records already attached to it.
                if ((float) $adjustment->amount !== $credit) {
                    $adjustment->update(['amount' => $credit]);
                    $changed = true;
                }
            } elseif ($unapplied->isNotEmpty() && $this->hasActiveAppliedVoucher($bill)) {
                if ($credit <= 0) {
                    IncentiveAward::query()
                        ->whereKey($unapplied->modelKeys())
                        ->where('status', IncentiveAward::STATUS_ELIGIBLE)
                        ->update([
                            'status' => IncentiveAward::STATUS_APPLIED_NO_BALANCE,
                            'applied_at' => now(),
                        ]);

                    $this->notifyRedemption($enrollment, $unapplied, 0, noBalance: true);

                    return null;
                }

                $adjustment = $bill->adjustments()->create([
                    'discount_id' => null,
                    'incentive_key' => BillAdjustment::INCENTIVE_KEY_ZERO_TUITION,
                    'label' => self::LABEL,
                    'type' => 'full',
                    'value' => 0,
                    'amount' => $credit,
                ]);
                $changed = true;
            } else {
                // A new award cannot be redeemed through a retired/missing voucher,
                // even if an unrelated historical voucher adjustment remains.
                return $existing;
            }

            if ($unapplied->isNotEmpty() && $this->hasActiveAppliedVoucher($bill)) {
                IncentiveAward::query()
                    ->whereKey($unapplied->modelKeys())
                    ->where('status', IncentiveAward::STATUS_ELIGIBLE)
                    ->update([
                        'bill_adjustment_id' => $adjustment->id,
                        'status' => IncentiveAward::STATUS_APPLIED,
                        'applied_at' => now(),
                    ]);

                $this->notifyRedemption(
                    $enrollment,
                    $unapplied,
                    (float) $adjustment->amount,
                    alreadyCredited: $existing !== null,
                );
            }

            // Keep all derived bill/enrollment state consistent for late credits.
            if ($changed) {
                $bill->unsetRelation('adjustments');
                $bill->load(['schoolYear', 'enrollment', 'adjustments']);
                ($this->generateSchedule)($bill);
                $bill->load('installments');
                $bill->recalculate();
                $bill->settleEnrollment();
            }

            return $adjustment->fresh();
        });
    }

    private function hasActiveAppliedVoucher(Bill $bill): bool
    {
        return $bill->hasActiveVoucher();
    }

    /**
     * Notify once for the exact award set redeemed by this reconciliation run.
     * The dedupe key keeps retries and concurrent delivery harmless.
     */
    private function notifyRedemption(
        Enrollment $enrollment,
        \Illuminate\Support\Collection $awards,
        float $amount,
        bool $noBalance = false,
        bool $alreadyCredited = false,
    ): void {
        if ($enrollment->student === null || $awards->isEmpty()) {
            return;
        }

        $reasons = $awards->pluck('type')
            ->map(fn (string $type) => match ($type) {
                IncentiveAward::TYPE_EARLY_ENROLLMENT => 'Early enrollment',
                IncentiveAward::TYPE_REFERRAL => 'Referral',
                default => (string) str($type)->replace('_', ' ')->title(),
            })
            ->unique()
            ->implode(' and ');
        $ids = $awards->modelKeys();
        sort($ids);

        ($this->notify)(
            $enrollment->student,
            'billing',
            $noBalance || $alreadyCredited ? 'Tuition incentive confirmed' : 'Tuition incentive applied',
            match (true) {
                $noBalance => "Your {$reasons} incentive qualified after this bill was already settled. No refund or carry-forward was created.",
                $alreadyCredited => "Your {$reasons} qualification was linked to the existing ₱".number_format($amount, 2).' tuition credit. The credit is counted once.',
                default => "Your {$reasons} incentive waived ₱".number_format($amount, 2).' from your unpaid balance.',
            },
            ctaLabel: 'View bill',
            ctaUrl: '/portal/bills',
            dedupeKey: 'incentive-awards:'.implode('-', $ids).($noBalance ? ':no-balance' : ':applied'),
        );
    }

    private function adoptLegacyEarlyAdjustment(Bill $bill, Enrollment $enrollment): ?BillAdjustment
    {
        $label = Freebie::query()
            ->where('school_year_id', $enrollment->school_year_id)
            ->where('type', IncentiveAward::TYPE_EARLY_ENROLLMENT)
            ->value('name');

        if ($label === null) {
            return null;
        }

        $legacy = $bill->adjustments()
            ->whereNull('discount_id')
            ->whereNull('incentive_key')
            ->where('type', 'full')
            ->where('label', $label)
            ->first();

        if ($legacy !== null) {
            $legacy->update(['incentive_key' => BillAdjustment::INCENTIVE_KEY_ZERO_TUITION]);
        }

        return $legacy?->fresh();
    }
}
