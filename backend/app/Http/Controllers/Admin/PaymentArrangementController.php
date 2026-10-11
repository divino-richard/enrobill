<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\PaymentArrangement;
use App\Models\Student;
use App\Services\Currency;
use App\Services\PaymentArrangementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentArrangementController extends Controller
{
    public function update(Request $request, Bill $bill): BillResource
    {
        $input = $request->validate([
            'remarks' => ['required', 'string', 'max:2000'],
            'installments' => ['required', 'array', 'min:1', 'max:60'],
            'installments.*.dueDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.now('Asia/Manila')->toDateString(), 'distinct'],
            'installments.*.amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
        ]);

        return DB::transaction(function () use ($request, $bill, $input) {
            Student::lockForUpdate()->findOrFail($bill->student_id);
            Enrollment::whereKey($bill->enrollment_id)->lockForUpdate()->first();
            $bill = Bill::lockForUpdate()->findOrFail($bill->id);
            abort_if($bill->isDroppingBill(), 422, 'Dropping balances are payable upon re-enrollment. Payment arrangements cannot replace full settlement.');
            abort_unless($bill->enrollment?->status === 'dropped', 422, 'Payment arrangements are available for a dropped enrollment’s bill.');
            abort_unless($bill->balance() > 0, 422, 'This bill has no remaining balance.');
            abort_if($bill->payments()->where('status', 'pending')->exists(), 422, 'Review pending payments before making an arrangement.');
            $total = collect($input['installments'])->sum(fn ($row) => Currency::cents($row['amount']));
            if ($total !== Currency::cents($bill->balance())) {
                throw ValidationException::withMessages(['installments' => 'The installments must add up to the full remaining balance.']);
            }

            PaymentArrangement::updateOrCreate(['bill_id' => $bill->id], [
                'remarks' => $input['remarks'],
                'approved_by' => $request->user()->id,
                'starting_paid' => $bill->effectivePaymentTotal(),
                'installments' => collect($input['installments'])->sortBy('dueDate')->values()->all(),
            ]);
            app(PaymentArrangementService::class)->settleReturns($bill);

            return new BillResource($bill->fresh()->load(['schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']));
        }, 3);
    }
}
