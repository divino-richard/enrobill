<?php

namespace App\Http\Resources;

use App\Models\SchoolYear;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SchoolYear
 */
class SchoolYearResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'schoolYear' => $this->school_year,
            'currentSemester' => $this->current_semester,
            'startDate' => $this->start_date?->format('Y-m-d'),
            'endDate' => $this->end_date?->format('Y-m-d'),
            'isActive' => (bool) $this->is_active,
            'admissionOpen' => (bool) $this->admission_open,
            'downpaymentType' => $this->downpayment_type,
            'downpaymentValue' => $this->downpayment_value !== null ? (float) $this->downpayment_value : null,
            'installmentCount' => $this->installment_count,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
