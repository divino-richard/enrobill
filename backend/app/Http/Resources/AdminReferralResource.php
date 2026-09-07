<?php

namespace App\Http\Resources;

use App\Models\Referral;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Referral */
class AdminReferralResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $application = $this->referredApplication;
        $referrer = $this->referrerStudent;
        $referred = $this->referredStudent;

        return [
            'id' => $this->id,
            'code' => $this->referralCode?->code,
            'schoolYearId' => $this->school_year_id,
            'schoolYear' => $this->targetSchoolYear?->school_year,
            'referrer' => $referrer ? [
                'id' => $referrer->id,
                'studentNumber' => $referrer->student_number,
                'name' => trim($referrer->first_name.' '.$referrer->last_name),
            ] : null,
            'referredApplication' => $application ? [
                'id' => $application->id,
                'reference' => $application->reference,
                'name' => trim($application->given_name.' '.$application->surname),
            ] : null,
            'referredStudent' => $referred ? [
                'id' => $referred->id,
                'studentNumber' => $referred->student_number,
                'name' => trim($referred->first_name.' '.$referred->last_name),
            ] : null,
            'status' => $this->status,
            'claimedAt' => $this->claimed_at?->toIso8601String(),
            'acceptedAt' => $this->accepted_at?->toIso8601String(),
            'successfulAt' => $this->successful_at?->toIso8601String(),
            'cancelledAt' => $this->cancelled_at?->toIso8601String(),
            'cancellationReason' => $this->cancellation_reason,
            'claimedBy' => $this->actor($this->claimant),
            'updatedBy' => $this->actor($this->updater),
            'acceptedBy' => $this->actor($this->accepter),
            'cancelledBy' => $this->actor($this->canceller),
        ];
    }

    /**
     * @return array{id: int, name: string}|null
     */
    private function actor(?User $actor): ?array
    {
        return $actor ? [
            'id' => $actor->id,
            'name' => $actor->name,
        ] : null;
    }
}
