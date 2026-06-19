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
            'isOpen' => (bool) $this->is_open,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
