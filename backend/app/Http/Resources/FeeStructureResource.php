<?php

namespace App\Http\Resources;

use App\Models\FeeStructure;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FeeStructure
 */
class FeeStructureResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $items = $this->items;

        return [
            'id' => $this->id,
            'termId' => $this->term_id,
            'schoolYear' => $this->term?->school_year,
            'semester' => $this->term?->semester,
            'track' => $this->track,
            'yearLevel' => $this->year_level,
            'items' => $items->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'amount' => (float) $item->amount,
            ])->values(),
            'total' => (float) $items->sum('amount'),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
