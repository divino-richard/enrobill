<?php

namespace App\Http\Resources;

use App\Models\SchoolYearFee;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SchoolYearFee
 */
class SchoolYearFeeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'schoolYearId' => $this->school_year_id,
            'yearLevel' => $this->year_level,
            'category' => $this->category,
            'name' => $this->name,
            'type' => $this->type,
            'amount' => (float) $this->amount,
            'sequence' => (int) $this->sequence,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
