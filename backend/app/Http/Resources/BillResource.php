<?php

namespace App\Http\Resources;

use App\Models\Bill;
use App\Models\StudentCredit;
use App\Services\ReturningEnrollmentRules;
use App\Services\StudentCreditService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
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
        $netTotal = $this->netTotal();
        $paid = (float) $this->amount_paid;

        return [
            'id' => $this->id,
            'studentId' => $this->student_id,
            'schoolYearId' => $this->school_year_id,
            'schoolYear' => $this->schoolYear?->school_year,
            'enrollmentStatus' => $this->enrollment?->status,
            'status' => $this->status,
            'collectionState' => $this->collectionState(),
            'returnRequirements' => app(ReturningEnrollmentRules::class)->billReturnRequirements($this->resource),
            'historicalInstallments' => $this->historicalInstallments(),
            'noDownpayment' => (bool) ($this->whenLoaded('enrollment', fn () => $this->enrollment?->no_downpayment, false)),
            'installmentPolicy' => $this->schoolYear ? [
                'downpaymentValue' => $this->schoolYear->downpayment_value !== null
                    ? (float) $this->schoolYear->downpayment_value
                    : null,
                'installmentCount' => $this->schoolYear->installment_count,
            ] : null,
            // Gross charges (sum of line items) before any credits.
            'total' => $gross,
            'discountTotal' => $discountTotal,
            // What the student actually owes after credits.
            'netTotal' => $netTotal,
            'amountPaid' => $paid,
            'pendingPaymentCount' => $this->whenCounted('pending_payments'),
            'assessmentOriginalTotal' => $gross,
            'droppingAssessment' => $this->droppingAssessment?->snapshot,
            'creditApplied' => $this->creditApplied(),
            'appliedCredits' => $this->appliedCreditLines(),
            'creditIssued' => (float) ($this->issuedCredit?->amount ?? 0),
            'effectivePaymentTotal' => $this->effectivePaymentTotal(),
            'availableCredit' => app(StudentCreditService::class)->availableFor($this->student_id),
            'previousBalance' => $this->enrollment ? app(StudentCreditService::class)->previousBalance($this->enrollment) : 0,
            'paymentArrangement' => $this->paymentArrangement ? [
                'remarks' => $this->paymentArrangement->remarks,
                'approvedBy' => $this->paymentArrangement->approved_by,
                'startingPaid' => (float) $this->paymentArrangement->starting_paid,
                'installments' => $this->paymentArrangement->installments,
                'approvedAt' => $this->paymentArrangement->updated_at?->toIso8601String(),
            ] : null,
            'creditHistory' => StudentCredit::where('student_id', $this->student_id)->with('allocations')->get()->map(fn ($credit) => [
                'id' => $credit->id, 'sourceBillId' => $credit->source_bill_id,
                'kind' => $credit->kind, 'label' => $credit->label(),
                'amount' => (float) $credit->amount, 'remaining' => $credit->remaining(),
                'allocated' => round((float) $credit->amount - $credit->remaining(), 2),
                'allocations' => $credit->allocations->map(fn ($allocation) => [
                    'id' => $allocation->id, 'billId' => $allocation->bill_id,
                    'amount' => (float) $allocation->amount,
                    'releasedAmount' => (float) $allocation->released_amount,
                ]),
            ]),
            // Late discounts/incentives never turn prior payments into a refund.
            'balance' => $this->balance(),
            // What a student should pay now (next installment, else balance).
            'amountDue' => $this->amountDue(),
            'items' => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'category' => $item->category,
                'droppingComponent' => $item->dropping_component,
                'sourceFeeId' => $item->source_fee_id,
                'amount' => (float) $item->amount,
            ])->values(),
            'adjustments' => $this->whenLoaded('adjustments', fn () => $this->adjustments->map(fn ($adjustment) => [
                'id' => $adjustment->id,
                'discountId' => $adjustment->discount_id,
                'incentiveKey' => $adjustment->incentive_key,
                'label' => $adjustment->label,
                'type' => $adjustment->type,
                'value' => (float) $adjustment->value,
                'amount' => (float) $adjustment->amount,
                // One monetary row may carry both early-enrollment and referral
                // qualification reasons. The amount is still counted only once.
                'reasons' => $adjustment->incentiveAwards
                    ->map(fn ($award) => match ($award->type) {
                        'early_enrollment' => 'Early enrollment',
                        'referral' => 'Referral',
                        default => (string) str($award->type)->replace('_', ' ')->title(),
                    })
                    ->unique()
                    ->values(),
                'locked' => $this->isDroppingBill() || $adjustment->incentive_key !== null,
            ])->values()),
            'installments' => $this->whenLoaded('installments', fn () => $this->resource->installmentSchedule()),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments
                ->sortByDesc('paid_at')
                ->map(fn ($payment) => [
                    'id' => $payment->id,
                    'creditProtected' => $payment->status === 'verified' && ($this->isDroppingBill() || $this->issuedCredit !== null),
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
                'track' => $this->enrollment?->track ?? $this->student->track_or_strand,
                'yearLevel' => $this->enrollment?->year_level ?? $this->student->year_level,
            ]),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
