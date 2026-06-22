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
            'schoolYear' => $this->term?->school_year,
            'semester' => $this->term?->semester,
            'program' => $this->track,
            'yearLevel' => $this->year_level,
            'status' => $this->status,
            'enrolledAt' => $this->enrolled_at?->toIso8601String(),
            'isCurrent' => (bool) $this->term?->is_active,
        ];
    }
}
