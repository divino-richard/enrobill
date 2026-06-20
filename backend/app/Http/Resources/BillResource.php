<?php

namespace App\Http\Resources;

use App\Models\Bill;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

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
        $gross = (float) $this->total;
        $discountTotal = $this->discountTotal();
        $netTotal = round(max($gross - $discountTotal, 0), 2);
        $paid = (float) $this->amount_paid;

        return [
            'id' => $this->id,
            'studentId' => $this->student_id,
            'termId' => $this->term_id,
            'schoolYear' => $this->term?->school_year,
            'semester' => $this->term?->semester,
            'status' => $this->status,
            'paymentOption' => $this->payment_option,
            'installmentsAllowed' => (bool) ($this->term?->installments_enabled),
            'installmentPolicy' => $this->term && $this->term->installments_enabled ? [
                'downpaymentType' => $this->term->downpayment_type,
                'downpaymentValue' => $this->term->downpayment_value !== null
                    ? (float) $this->term->downpayment_value
                    : null,
                'installmentCount' => $this->term->installment_count,
            ] : null,
            // Gross charges (sum of line items) before any credits.
            'total' => $gross,
            'discountTotal' => $discountTotal,
            // What the student actually owes after credits.
            'netTotal' => $netTotal,
            'amountPaid' => $paid,
            'balance' => round($netTotal - $paid, 2),
            // What a student should pay now (next installment, else balance).
            'amountDue' => $this->amountDue(),
            'items' => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'amount' => (float) $item->amount,
            ])->values(),
            'adjustments' => $this->whenLoaded('adjustments', fn () => $this->adjustments->map(fn ($adjustment) => [
                'id' => $adjustment->id,
                'discountId' => $adjustment->discount_id,
                'label' => $adjustment->label,
                'type' => $adjustment->type,
                'value' => (float) $adjustment->value,
                'amount' => (float) $adjustment->amount,
            ])->values()),
            'installments' => $this->whenLoaded('installments', fn () => $this->installmentSchedule($paid)),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments
                ->sortByDesc('paid_at')
                ->map(fn ($payment) => [
                    'id' => $payment->id,
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'status' => $payment->status,
                    'reference' => $payment->reference,
                    'proofUrl' => $payment->proof_key
                        ? Storage::disk('s3')->temporaryUrl($payment->proof_key, now()->addMinutes(10))
                        : null,
                    'paidAt' => $payment->paid_at?->toDateString(),
                    'note' => $payment->note,
                    'recordedBy' => $payment->relationLoaded('recorder') ? $payment->recorder?->name : null,
                    'submittedBy' => $payment->relationLoaded('submitter') ? $payment->submitter?->name : null,
                ])->values()),
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

    /**
     * Build the installment schedule, allocating the amount paid across
     * installments in due order so each row reports how much it has covered.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function installmentSchedule(float $paid): Collection
    {
        $remaining = $paid;
        $today = Carbon::today();

        return $this->installments->map(function ($installment) use (&$remaining, $today) {
            $amount = (float) $installment->amount;
            $applied = round(min($remaining, $amount), 2);
            $remaining = round($remaining - $applied, 2);

            $status = match (true) {
                $applied <= 0 => 'unpaid',
                $applied >= $amount => 'paid',
                default => 'partial',
            };

            $overdue = $status !== 'paid'
                && $installment->due_date !== null
                && $installment->due_date->lt($today);

            return [
                'id' => $installment->id,
                'sequence' => $installment->sequence,
                'label' => $installment->label,
                'amount' => $amount,
                'amountPaid' => $applied,
                'balance' => round($amount - $applied, 2),
                'dueDate' => $installment->due_date?->toDateString(),
                'status' => $overdue ? 'overdue' : $status,
            ];
        })->values();
    }
}
