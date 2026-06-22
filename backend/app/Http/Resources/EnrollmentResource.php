<?php

namespace App\Http\Resources;

use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Enrollment
 */
class EnrollmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'schoolYear' => $this->schoolYear?->school_year,
            'semester' => $this->schoolYear?->current_semester,
            'program' => $this->track,
            'yearLevel' => $this->year_level,
            'noDownpayment' => (bool) $this->no_downpayment,
            'status' => $this->status,
            'enrolledAt' => $this->enrolled_at?->toIso8601String(),
            'isCurrent' => (bool) $this->schoolYear?->is_active,
        ];
    }
}
