<?php

namespace App\Http\Resources;

use App\Models\StudentDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StudentDocument
 */
class StudentDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'semester' => $this->semester,
            'type' => $this->type,
            'fileName' => $this->file_name,
            'size' => $this->size,
            'contentType' => $this->content_type,
            'uploadedAt' => $this->updated_at?->toIso8601String(),
            // Set by the controller from the matching SemesterStanding row —
            // not a real column on this model. Defaults to "pending" for
            // callers (e.g. the admin roster) that never set it.
            'reviewStatus' => $this->review_status ?? 'pending',
            'reviewNote' => $this->review_note ?? null,
        ];
    }
}
