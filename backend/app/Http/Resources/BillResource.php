<?php

namespace App\Http\Resources;

use App\Models\Bill;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Bill
 */
class BillResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $total = (float) $this->total;
        $paid = (float) $this->amount_paid;

        return [
            'id' => $this->id,
            'studentId' => $this->student_id,
            'termId' => $this->term_id,
            'schoolYear' => $this->term?->school_year,
            'semester' => $this->term?->semester,
            'status' => $this->status,
            'total' => $total,
            'amountPaid' => $paid,
            'balance' => round($total - $paid, 2),
            'items' => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'amount' => (float) $item->amount,
            ])->values(),
            // Present in admin listings (when the student is eager-loaded).
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student->id,
                'studentNumber' => $this->student->student_number,
                'name' => trim($this->student->first_name.' '.$this->student->last_name),
                'track' => $this->student->track_or_strand,
                'yearLevel' => $this->student->year_level,
            ]),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
