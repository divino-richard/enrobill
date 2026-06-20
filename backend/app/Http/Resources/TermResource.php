<?php

namespace App\Http\Resources;

use App\Models\Term;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Term
 */
class TermResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'schoolYear' => $this->school_year,
            'semester' => $this->semester,
            'startDate' => $this->start_date?->format('Y-m-d'),
            'endDate' => $this->end_date?->format('Y-m-d'),
            'isOpen' => (bool) $this->is_open,
            'installmentsEnabled' => (bool) $this->installments_enabled,
            'downpaymentType' => $this->downpayment_type,
            'downpaymentValue' => $this->downpayment_value !== null ? (float) $this->downpayment_value : null,
            'installmentCount' => $this->installment_count,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
