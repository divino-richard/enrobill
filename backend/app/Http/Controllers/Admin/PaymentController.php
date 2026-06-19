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
    private const METHODS = ['cash', 'gcash', 'bank', 'card', 'check'];

    /**
     * Record a payment against a bill and recompute its balance and status.
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
            'reference' => $validated['reference'] ?? null,
            'paid_at' => $validated['paidAt'],
            'note' => $validated['note'] ?? null,
            'recorded_by' => $request->user()?->id,
        ]);

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
            $bill->fresh()->load(['term', 'items', 'adjustments', 'installments', 'payments.recorder']),
        );
    }
}
