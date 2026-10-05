<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\PaymentArrangement;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class PaymentArrangementService
{
    /** Display and payment validation share the same replacement schedule. */
    public function schedule(Bill $bill): ?Collection
    {
        $arrangement = PaymentArrangement::where('bill_id', $bill->id)->first();
        if (! $arrangement) {
            return null;
        }
        $received = max(Currency::cents($bill->effectivePaymentTotal()) - Currency::cents($arrangement->starting_paid), 0);

        return collect($arrangement->installments)->sortBy('dueDate')->values()->map(function ($row, $index) use (&$received, $arrangement) {
            $amount = Currency::cents($row['amount']);
            $applied = min($received, $amount);
            $received -= $applied;
            $remaining = $amount - $applied;
            $status = $remaining === 0 ? 'paid' : ($row['dueDate'] < now('Asia/Manila')->toDateString() ? 'overdue' : ($applied > 0 ? 'partial' : 'unpaid'));

            return ['id' => -($arrangement->id * 100 + $index + 1), 'sequence' => $index + 1,
                'label' => 'Payment arrangement '.($index + 1), 'amount' => Currency::pesos($amount),
                'amountPaid' => Currency::pesos($applied), 'balance' => Currency::pesos($remaining),
                'dueDate' => $row['dueDate'], 'status' => $status];
        });
    }

    /** A current arrangement must cover every remaining peso without overdue installments. */
    public function covers(Bill $bill): bool
    {
        if ($bill->balance() <= 0) {
            return true;
        }

        $arrangement = PaymentArrangement::where('bill_id', $bill->id)->first();
        if ($arrangement === null) {
            return false;
        }

        $paid = Currency::cents($bill->effectivePaymentTotal());
        $baseline = Currency::cents($arrangement->starting_paid);
        if ($paid < $baseline) {
            return false;
        }

        $received = $paid - $baseline;
        $remaining = 0;
        foreach (collect($arrangement->installments)->sortBy('dueDate') as $installment) {
            $amount = Currency::cents($installment['amount']);
            $applied = min($received, $amount);
            $received -= $applied;
            $outstanding = $amount - $applied;
            $remaining += $outstanding;
            if ($outstanding > 0 && $installment['dueDate'] < Carbon::now('Asia/Manila')->toDateString()) {
                return false;
            }
        }

        return $remaining >= Currency::cents($bill->balance());
    }

    /** Settle pending returns after a prior bill is paid or its arrangement is approved. */
    public function settleReturns(Bill $bill): void
    {
        $enrollments = $bill->student->enrollments()
            ->where('status', 'pending')
            ->whereNotNull('returning_from_enrollment_id')
            ->orderBy('id')->lockForUpdate()->get();

        foreach ($enrollments as $enrollment) {
            $nextBill = $enrollment->bill()->lockForUpdate()->first();
            $nextBill?->settleEnrollment();
        }
    }
}
