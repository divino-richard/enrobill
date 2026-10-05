<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\BillItem;
use App\Models\DroppingAssessment;
use App\Models\DroppingPolicy;
use App\Models\DroppingRequest;
use App\Models\StudentCredit;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class DroppingFinance
{
    public function preview(DroppingRequest $request, string $effectiveDate): array
    {
        $saved = DroppingAssessment::where('request_id', $request->id)->first();
        if ($saved) {
            return $saved->snapshot;
        }
        $legacy = $request->status === 'confirmed';
        $enrollment = $request->enrollment()->with('schoolYear')->first();
        $bill = Bill::where('enrollment_id', $request->enrollment_id)->first();
        $policy = DroppingPolicy::where('school_year_id', $enrollment?->school_year_id)->orderByDesc('version')->first();
        $issues = [];
        if ($legacy) {
            $issues[] = 'Approved before dropping charges were enabled. The original bill is unchanged.';
        }
        if (! $enrollment || ! in_array($enrollment->year_level, ['grade_11', 'grade_12'], true)) {
            $issues[] = 'Dropping charges are available for senior high school enrollments only.';
        }
        if (! $bill) {
            $issues[] = 'Generate the original bill before approving this request.';
        }
        if (! $policy?->enabled) {
            $issues[] = 'Set up and enable this school year’s dropping policy.';
        }
        $period = null;
        $previousEnd = null;
        foreach (DroppingPolicy::PERIODS as $key) {
            $range = $policy?->periods[$key] ?? [];
            $start = $range['startsOn'] ?? null;
            $end = $range['endsOn'] ?? null;
            if (! $this->validDate($start) || ! $this->validDate($end) || $end < $start || ($previousEnd && Carbon::parse($previousEnd)->addDay()->toDateString() !== $start)) {
                $issues[] = 'Dropping periods must have complete, consecutive, non-overlapping dates.';
                break;
            }
            $previousEnd = $end;
            if ($effectiveDate >= $start && $effectiveDate <= $end) {
                $period = $key;
            }
        }
        if (! $this->validDate($effectiveDate)) {
            $issues[] = 'Choose a valid effective dropping date.';
        } elseif ($effectiveDate > now('Asia/Manila')->toDateString()) {
            $issues[] = 'The effective dropping date cannot be in the future.';
        } elseif ($enrollment?->enrolled_at && $effectiveDate < $enrollment->enrolled_at->timezone('Asia/Manila')->toDateString()) {
            $issues[] = 'The dropping date must be on or after enrollment.';
        }
        if (! $period) {
            $issues[] = 'The effective date is outside the configured dropping periods.';
        }
        $category = $enrollment?->dropping_category;
        if (! in_array($category, ['paying', 'voucher_esc'], true)) {
            $issues[] = 'Confirm whether this enrollment is Paying or Voucher / ESC.';
        }
        $breakdown = array_fill_keys(BillItem::DROPPING_COMPONENTS, 0);
        $items = $bill?->items()->orderBy('id')->get() ?? collect();
        $original = 0;
        foreach ($items as $item) {
            $amount = Currency::cents($item->amount);
            $original += $amount;
            if (! in_array($item->dropping_component, BillItem::DROPPING_COMPONENTS, true) || $amount < 0) {
                $issues[] = 'Classify each original fee before approving this request.';
            } else {
                $breakdown[$item->dropping_component] += $amount;
            }
        }
        if ($bill && ($items->isEmpty() || $original !== Currency::cents($bill->total))) {
            $issues[] = 'The original fee items must match the original bill total.';
        }
        $payments = $bill?->payments()->orderBy('id')->get() ?? collect();
        if ($payments->contains('status', 'pending')) {
            $issues[] = 'Verify or reject pending payments before approving this request.';
        }
        $paid = $payments->where('status', 'verified')->sum(fn ($payment) => Currency::cents($payment->amount));
        $final = 0;
        $formula = $policy?->formulas[$category][$period] ?? null;
        if (! is_array($formula)) {
            $issues[] = 'The dropping policy formula is missing.';
        } else {
            $hundredths = 0;
            foreach ($formula as $component => $percent) {
                if (! in_array($component, [...BillItem::DROPPING_COMPONENTS, 'total'], true) || ! is_int($percent) || $percent < 0 || $percent > 100) {
                    $issues[] = 'The dropping policy formula is invalid.';

                    continue;
                }
                $hundredths += ($component === 'total' ? $original : $breakdown[$component]) * $percent;
            }
            $final = intdiv($hundredths + 50, 100);
        }
        $creditApplied = $bill ? min(Currency::cents($bill->creditApplied()), max($final - $paid, 0)) : 0;
        $data = [
            'ready' => $issues === [], 'issues' => array_values(array_unique($issues)),
            'finalized' => false, 'legacy' => $legacy, 'formulas' => $policy?->formulas, 'effectiveDate' => $effectiveDate,
            'policyVersion' => $policy?->version, 'policyId' => $policy?->id,
            'period' => $period, 'category' => $category,
            'originalTotal' => Currency::pesos($original), 'finalCharge' => Currency::pesos($final),
            'verifiedPayments' => Currency::pesos($paid), 'creditApplied' => Currency::pesos($creditApplied),
            'balance' => Currency::pesos(max($final - $paid - $creditApplied, 0)),
            'credit' => Currency::pesos(max($paid - $final, 0)),
            'feeBreakdown' => array_map(fn ($value) => Currency::pesos($value), $breakdown),
        ];
        if ($legacy) {
            $data['finalCharge'] = null;
            $data['credit'] = null;
            $data['balance'] = $bill?->balance();
        }
        $data['fingerprint'] = hash('sha256', json_encode([
            $data, $policy?->periods, $items->map->only(['id', 'amount', 'dropping_component'])->all(),
            $payments->map->only(['id', 'amount', 'status'])->all(),
            $bill?->creditAllocations()->get(['id', 'amount', 'released_amount'])->toArray(),
        ], JSON_THROW_ON_ERROR));

        return $data;
    }

    /** Called under the approval transaction with student, enrollment and bill locks held. */
    public function finalize(DroppingRequest $request, string $effectiveDate, int $actorId): array
    {
        $saved = DroppingAssessment::where('request_id', $request->id)->first();
        if ($saved) {
            return $saved->snapshot;
        }
        $preview = $this->preview($request, $effectiveDate);
        if (! $preview['ready']) {
            throw ValidationException::withMessages(['assessment' => $preview['issues']]);
        }
        $bill = Bill::where('enrollment_id', $request->enrollment_id)->lockForUpdate()->firstOrFail();
        $snapshot = [...$preview,
            'finalized' => true, 'approvedAt' => now()->toIso8601String(), 'approvedBy' => $actorId,
            'policyPeriods' => DroppingPolicy::findOrFail($preview['policyId'])->periods,
            'originalItems' => $bill->items()->get()->toArray(),
            'originalAdjustments' => $bill->adjustments()->get()->toArray(),
            'originalInstallments' => $bill->installments()->get()->toArray(),
            'originalPayments' => $bill->payments()->where('status', 'verified')->get(['id', 'amount', 'paid_at', 'method', 'status'])->toArray(),
        ];
        DroppingAssessment::create([
            'request_id' => $request->id, 'enrollment_id' => $request->enrollment_id,
            'bill_id' => $bill->id, 'policy_id' => $preview['policyId'], 'approved_by' => $actorId,
            'final_charge' => $preview['finalCharge'], 'snapshot' => $snapshot,
        ]);
        $bill->unsetRelation('droppingAssessment');
        if ($preview['credit'] > 0) {
            StudentCredit::firstOrCreate(['source_bill_id' => $bill->id], [
                'student_id' => $bill->student_id, 'amount' => $preview['credit'], 'issued_by' => $actorId,
            ]);
        }
        $bill->recalculate();

        return $snapshot;
    }

    private function validDate(?string $date): bool
    {
        return $date !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
            && checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4));
    }
}
