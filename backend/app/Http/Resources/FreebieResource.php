<?php

namespace App\Http\Resources;

use App\Models\Freebie;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Freebie
 */
class FreebieResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'schoolYearId' => $this->school_year_id,
            'type' => $this->type,
            'name' => $this->name,
            'isActive' => (bool) $this->is_active,
            'startsOn' => $this->starts_on?->toDateString(),
            'endsOn' => $this->ends_on?->toDateString(),
            'minReferrals' => $this->min_referrals,
        ];
    }
}
