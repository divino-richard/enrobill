<?php

namespace App\Http\Resources;

use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Application
 */
class ApplicationResource extends JsonResource
{
    /**
     * Human-readable track / strand labels keyed by their stored code.
     */
    private const TRACK_LABELS = [
        'stem' => 'STEM',
        'assh' => 'ASSH',
        'abm' => 'BE-ABM',
        'gas' => 'GAS',
        'creative_arts' => 'Creative Arts',
        'hospitality' => 'Hospitality',
        'ict' => 'ICT',
    ];

    private const SEMESTER_LABELS = [
        'first' => '1st Semester',
        'second' => '2nd Semester',
    ];

    /**
     * Shape an application for API output. Keys are camelCase to match the
     * React `Application` model directly.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'program' => self::TRACK_LABELS[$this->track_or_strand] ?? ($this->track_or_strand ?? '—'),
            'schoolYear' => $this->school_year ?? '—',
            'semester' => self::SEMESTER_LABELS[$this->semester] ?? ($this->semester ?? '—'),
            'status' => $this->status,
            'submittedAt' => $this->submitted_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'documents' => $this->whenLoaded('documents', fn () => $this->documents->map(fn ($document) => [
                'type' => $document->type,
                'key' => $document->s3_key,
                'fileName' => $document->file_name,
                'size' => $document->size,
                'contentType' => $document->content_type,
            ])),
        ];
    }
}
