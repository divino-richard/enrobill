<?php

namespace App\Http\Resources;

use App\Models\Section;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Section
 */
class SectionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $enrollments = $this->whenLoaded('enrollments');

        return [
            'id' => $this->id,
            'schoolYearId' => $this->school_year_id,
            'program' => $this->program,
            'yearLevel' => $this->year_level,
            'name' => $this->name,
            'capacity' => $this->capacity,
            'assignedCount' => $this->relationLoaded('enrollments') ? $this->enrollments->count() : 0,
            'students' => $this->relationLoaded('enrollments')
                ? $this->enrollments->map(fn ($enrollment) => [
                    'enrollmentId' => $enrollment->id,
                    'studentId' => $enrollment->student_id,
                    'studentNumber' => $enrollment->student?->student_number,
                    'name' => trim(($enrollment->student?->first_name ?? '').' '.($enrollment->student?->last_name ?? '')),
                    'status' => $enrollment->status,
                ])->values()
                : [],
        ];
    }
}
