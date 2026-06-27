<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public const METHODS = ['cash', 'gcash', 'maya', 'bank'];

    /**
     * Record a verified payment against a bill and recompute its balance and
     * status. (Cashier-recorded payments — e.g. cash at the window — are trusted
     * and count immediately.)
     */
    public function store(Request $request, Bill $bill): BillResource
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'method' => ['required', Rule::in(self::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'paidAt' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $balance = round($bill->netTotal() - (float) $bill->amount_paid, 2);

        if ($validated['amount'] > $balance + 0.01) {
            throw ValidationException::withMessages([
                'amount' => "The payment exceeds the outstanding balance of {$balance}.",
            ]);
        }

        $bill->payments()->create([
            'amount' => $validated['amount'],
            'method' => $validated['method'],
            'status' => 'verified',
            'reference' => $validated['reference'] ?? null,
            'paid_at' => $validated['paidAt'],
            'note' => $validated['note'] ?? null,
            'recorded_by' => $request->user()?->id,
        ]);

        $bill->recalculate();
        $bill->settleEnrollment();

        return $this->billResource($bill);
    }

    /**
     * Finalize a student-submitted payment — verify it so it counts toward the
     * balance.
     */
    public function verify(Bill $bill, Payment $payment): BillResource
    {
        abort_if($payment->bill_id !== $bill->id, 404);

        $balance = round($bill->netTotal() - (float) $bill->amount_paid, 2);

        if ($payment->status !== 'verified' && (float) $payment->amount > $balance + 0.01) {
            throw ValidationException::withMessages([
                'payment' => "Verifying this payment would exceed the outstanding balance of {$balance}.",
            ]);
        }

        $payment->update(['status' => 'verified']);
        $bill->recalculate();
        $bill->settleEnrollment();

        return $this->billResource($bill);
    }

    /**
     * Reject a student-submitted payment (e.g. invalid proof).
     */
    public function reject(Bill $bill, Payment $payment): BillResource
    {
        abort_if($payment->bill_id !== $bill->id, 404);

        $payment->update(['status' => 'rejected']);
        $bill->recalculate();

        return $this->billResource($bill);
    }

    /**
     * Void a recorded payment and recompute the bill.
     */
    public function destroy(Bill $bill, Payment $payment): BillResource
    {
        abort_if($payment->bill_id !== $bill->id, 404);

        $payment->delete();
        $bill->recalculate();

        return $this->billResource($bill);
    }

    private function billResource(Bill $bill): BillResource
    {
        return new BillResource(
            $bill->fresh()->load(['schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
    }
}
