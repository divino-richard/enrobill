<?php

namespace App\Http\Resources;

use App\Models\Program;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Program
 */
class ProgramResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'category' => $this->category,
            'isActive' => $this->is_active,
            // Flat (name, year_level, amount) rows grouped into a per-item matrix:
            // { name, amounts: { <yearLevelCode>: amount } }.
            'feeItems' => $this->whenLoaded('feeItems', fn () => $this->feeItems
                ->groupBy('name')
                ->map(fn ($rows, $name) => [
                    'name' => $name,
                    'amounts' => $rows->mapWithKeys(fn ($row) => [$row->year_level => (float) $row->amount]),
                ])
                ->values()),
        ];
    }
}
