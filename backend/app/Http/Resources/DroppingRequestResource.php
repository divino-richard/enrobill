<?php

namespace App\Http\Resources;

use App\Services\StudentCreditService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DroppingRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $bill = $this->enrollment->bill;

        return [
            'id' => $this->id, 'reference' => $this->resource->reference(), 'enrollmentId' => $this->enrollment_id,
            'studentId' => $this->student_id, 'snapshot' => $this->snapshot, 'status' => $this->status,
            'packetVersion' => count($this->submissions), 'reason' => $this->reason, 'balance' => $bill?->balance() ?? 0,
            'billId' => $bill?->id,
            'droppingCategory' => $this->enrollment->dropping_category,
            'droppingAssessment' => $bill?->droppingAssessment?->snapshot,
            'financialSummary' => $bill?->droppingAssessment ? [
                'verifiedPayments' => (float) $bill->amount_paid,
                'balance' => $bill->balance(), 'creditApplied' => $bill->creditApplied(),
                'creditIssued' => (float) ($bill->issuedCredit?->amount ?? 0),
                'availableCredit' => app(StudentCreditService::class)->availableFor($bill->student_id),
            ] : null,
            'submissions' => collect($this->submissions)->map(fn ($submission) => [
                ...$submission, 'files' => collect($submission['files'])->map(fn ($file) => collect($file)->except(['path', 'disk'])->all())->all(),
            ])->all(),
            'events' => $this->events,
            'effectiveDate' => $this->effective_date?->toDateString(), 'confirmedAt' => $this->confirmed_at?->toIso8601String(),
            'finalRemarks' => $this->final_remarks, 'createdAt' => $this->created_at->toIso8601String(),
        ];
    }
}
