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
            // Only present on the global list, where these relations are loaded.
            'hasBill' => $this->relationLoaded('bill') ? $this->bill !== null : null,
            // Fee total for this enrollment's school year + level — the cashier's
            // preview before generating a bill.
            'feePreview' => $this->whenLoaded(
                'schoolYear',
                fn () => $this->schoolYear?->relationLoaded('fees')
                    ? round(
                        (float) $this->schoolYear->fees
                            ->whereIn('year_level', ['all', (string) $this->year_level])
                            ->sum('amount'),
                        2,
                    )
                    : null,
            ),
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student?->id,
                'name' => trim(($this->student?->first_name ?? '').' '.($this->student?->last_name ?? '')),
                'studentNumber' => $this->student?->student_number,
                'track' => $this->student?->track_or_strand,
                'yearLevel' => $this->student?->year_level,
            ]),
        ];
    }
}
