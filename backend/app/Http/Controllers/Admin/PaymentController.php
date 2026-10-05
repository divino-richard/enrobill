<?php

namespace App\Http\Controllers\Admin;

use App\Actions\NotifyStudent;
use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Student;
use App\Services\Currency;
use App\Services\PaymentArrangementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public const METHODS = ['cash', 'gcash', 'maya', 'bank'];

    public function __construct(private NotifyStudent $notify) {}

    public function store(Request $request, Bill $bill): BillResource
    {
        $input = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
            'method' => ['required', Rule::in(self::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'paidAt' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        return $this->locked($bill, function (Bill $bill) use ($request, $input) {
            abort_if($bill->payments()->where('status', 'pending')->exists(), 422, 'Review the pending payment before recording another payment.');
            $this->validateAmount($bill, (float) $input['amount']);
            $bill->payments()->create([
                'amount' => $input['amount'], 'method' => $input['method'], 'status' => 'verified',
                'reference' => $input['reference'] ?? null, 'paid_at' => $input['paidAt'],
                'note' => $input['note'] ?? null, 'recorded_by' => $request->user()->id,
            ]);
            $this->settle($bill);
            $this->notifyPayment($bill, 'Payment received', 'A payment of ₱'.number_format((float) $input['amount'], 2).' was recorded on your bill.');
        });
    }

    public function verify(Bill $bill, Payment $payment): BillResource
    {
        abort_if($payment->bill_id !== $bill->id, 404);

        return $this->locked($bill, function (Bill $bill) use ($payment) {
            $payment = $bill->payments()->lockForUpdate()->findOrFail($payment->id);
            if ($payment->status === 'verified') {
                return;
            }
            abort_unless($payment->status === 'pending', 422, 'Only a pending payment can be verified.');
            $this->validateAmount($bill, (float) $payment->amount);
            $payment->update(['status' => 'verified']);
            $this->settle($bill);
            $this->notifyPayment($bill, 'Payment verified', 'Your submitted payment of ₱'.number_format((float) $payment->amount, 2).' has been verified.');
        });
    }

    public function reject(Bill $bill, Payment $payment): BillResource
    {
        abort_if($payment->bill_id !== $bill->id, 404);

        return $this->locked($bill, function (Bill $bill) use ($payment) {
            $payment = $bill->payments()->lockForUpdate()->findOrFail($payment->id);
            if ($payment->status === 'rejected') {
                return;
            }
            $this->protectFinalizedPayment($bill, $payment);
            $payment->update(['status' => 'rejected']);
            $bill->recalculate();
            $this->notifyPayment($bill, 'Payment rejected', 'Your submitted payment of ₱'.number_format((float) $payment->amount, 2).' was rejected. Please resubmit.', true);
        });
    }

    public function destroy(Bill $bill, Payment $payment): BillResource
    {
        abort_if($payment->bill_id !== $bill->id, 404);

        return $this->locked($bill, function (Bill $bill) use ($payment) {
            $payment = $bill->payments()->lockForUpdate()->findOrFail($payment->id);
            $this->protectFinalizedPayment($bill, $payment);
            $amount = (float) $payment->amount;
            $payment->delete();
            $bill->recalculate();
            $this->notifyPayment($bill, 'Payment reversed', 'A payment of ₱'.number_format($amount, 2).' on your bill was voided.');
        });
    }

    private function protectFinalizedPayment(Bill $bill, Payment $payment): void
    {
        abort_if($payment->status === 'verified' && ($bill->droppingAssessment()->exists()
            || DB::table('student_credits')->where('source_bill_id', $bill->id)->exists()),
            422, 'This verified payment is part of a finalized dropping assessment or student credit and cannot be reversed.');
    }

    private function validateAmount(Bill $bill, float $amount): void
    {
        if (Currency::cents($amount) > Currency::cents($bill->balance())) {
            throw ValidationException::withMessages(['amount' => 'The payment exceeds the remaining balance of '.number_format($bill->balance(), 2, '.', '').'.']);
        }
    }

    private function settle(Bill $bill): void
    {
        $bill->recalculate();
        $bill->settleEnrollment();
        app(PaymentArrangementService::class)->settleReturns($bill);
    }

    private function notifyPayment(Bill $bill, string $title, string $message, bool $actionRequired = false): void
    {
        if ($bill->student !== null) {
            ($this->notify)($bill->student, 'billing', $title, $message,
                ctaLabel: 'View bill', ctaUrl: '/portal/bills/'.$bill->id, actionRequired: $actionRequired);
        }
    }

    private function locked(Bill $bill, callable $action): BillResource
    {
        return DB::transaction(function () use ($bill, $action) {
            Student::lockForUpdate()->findOrFail($bill->student_id);
            Enrollment::whereKey($bill->enrollment_id)->lockForUpdate()->first();
            $bill = Bill::lockForUpdate()->findOrFail($bill->id);
            $action($bill);

            return new BillResource($bill->fresh()->load(['schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']));
        }, 3);
    }
}
