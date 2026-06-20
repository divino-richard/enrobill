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
            'feeItems' => $this->whenLoaded('feeItems', fn () => $this->feeItems->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'amount' => (float) $item->amount,
            ])->values()),
        ];
    }
}
