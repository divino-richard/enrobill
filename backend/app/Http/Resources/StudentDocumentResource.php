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
        ];
    }
}
