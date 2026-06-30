<?php

namespace App\Http\Resources;

use App\Models\Bill;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

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
        $openBills = $this->openBills();

        return [
            'id' => $this->id,
            'schoolYear' => $this->schoolYear?->school_year,
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
            'openBillCount' => $this->studentBillsLoaded() ? $openBills->count() : null,
            'openBillTotal' => $this->studentBillsLoaded()
                ? round((float) $openBills->sum('balance'), 2)
                : null,
            'openBills' => $this->studentBillsLoaded() ? $openBills->all() : null,
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student?->id,
                'name' => trim(($this->student?->first_name ?? '').' '.($this->student?->last_name ?? '')),
                'studentNumber' => $this->student?->student_number,
                'track' => $this->student?->track_or_strand,
                'yearLevel' => $this->student?->year_level,
            ]),
        ];
    }

    private function studentBillsLoaded(): bool
    {
        return $this->relationLoaded('student')
            && $this->student !== null
            && $this->student->relationLoaded('bills');
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function openBills(): Collection
    {
        if (! $this->studentBillsLoaded()) {
            return collect();
        }

        return $this->student->bills
            ->filter(fn (Bill $bill) => $bill->status !== 'paid')
            ->sortByDesc(fn (Bill $bill) => $bill->schoolYear?->school_year ?? '')
            ->values()
            ->map(fn (Bill $bill) => [
                'id' => $bill->id,
                'schoolYear' => $bill->schoolYear?->school_year,
                'status' => $bill->status,
                'balance' => $this->billBalance($bill),
                'isCurrent' => (bool) $bill->schoolYear?->is_active,
            ]);
    }

    private function billBalance(Bill $bill): float
    {
        return round(max($bill->netTotal() - (float) $bill->amount_paid, 0), 2);
    }
}
