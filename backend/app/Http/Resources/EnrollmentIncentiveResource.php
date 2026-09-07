<?php

namespace App\Http\Resources;

use App\Models\BillAdjustment;
use App\Models\Enrollment;
use App\Models\IncentiveAward;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Enrollment */
class EnrollmentIncentiveResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hasVoucher = $this->hasValidVoucher();
        $awards = $this->relationLoaded('incentiveAwards')
            ? $this->incentiveAwards
            : collect();
        $adjustment = $awards->pluck('billAdjustment')->filter()->first()
            ?? $this->bill?->adjustments?->firstWhere(
                'incentive_key',
                BillAdjustment::INCENTIVE_KEY_ZERO_TUITION,
            );
        $awardRows = $awards->map(fn (IncentiveAward $award) => [
            'id' => $award->id,
            'role' => $award->beneficiary,
            'status' => $award->status,
            'reason' => $this->reasonFor($award, $hasVoucher),
            'freebie' => $award->freebie ? [
                'id' => $award->freebie->id,
                'name' => $award->freebie->name,
                'type' => $award->freebie->type,
            ] : null,
        ])->values();
        $reasons = $awardRows->pluck('reason')->filter()->unique()->values();

        if (! $hasVoucher) {
            $reasons->push('A valid voucher is required before an incentive can be applied.');
        }
        if ($awards->isEmpty()) {
            $reasons->push('No incentive award has been recorded for this enrollment.');
        }

        return [
            'hasVoucher' => $hasVoucher,
            'awards' => $awardRows,
            'reasons' => $reasons->unique()->values()->all(),
            'adjustment' => $adjustment ? [
                'id' => $adjustment->id,
                'label' => $adjustment->label,
                'amount' => (float) $adjustment->amount,
            ] : null,
        ];
    }

    private function hasValidVoucher(): bool
    {
        if ($this->bill !== null && $this->bill->hasActiveVoucher()) {
            return true;
        }

        return $this->discount !== null
            && $this->discount->category === 'voucher'
            && (bool) $this->discount->is_active;
    }

    private function reasonFor(IncentiveAward $award, bool $hasVoucher): string
    {
        return match ($award->status) {
            IncentiveAward::STATUS_APPLIED => 'Applied to the bill.',
            IncentiveAward::STATUS_APPLIED_NO_BALANCE => 'Qualified after the bill was already paid; no refund or carry-forward was created.',
            IncentiveAward::STATUS_CANCELLED => 'The award was cancelled before it was applied.',
            IncentiveAward::STATUS_PENDING => $award->enrollment_id === null
                ? 'Waiting for the beneficiary enrollment in the target school year.'
                : 'Waiting for the referral qualification to be completed.',
            IncentiveAward::STATUS_ELIGIBLE => match (true) {
                ! $hasVoucher => 'Eligible, but this enrollment does not have a valid voucher.',
                $this->bill === null => 'Eligible and waiting for a bill to be generated.',
                default => 'Eligible and waiting for the incentive to be applied.',
            },
            default => 'The award is awaiting review.',
        };
    }
}
