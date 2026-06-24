<?php

namespace App\Http\Controllers\Admin;

use App\Actions\GenerateInstallmentSchedule;
use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\BillAdjustment;
use App\Models\Discount;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BillAdjustmentController extends Controller
{
    /**
     * Apply a catalog discount to a bill, snapshotting its resolved peso credit.
     */
    public function store(Request $request, Bill $bill, GenerateInstallmentSchedule $generate): BillResource
    {
        $validated = $request->validate([
            'discountId' => [
                'required', 'integer', 'exists:discounts,id',
                // The same discount can't be applied to a bill twice.
                Rule::unique('bill_adjustments', 'discount_id')->where('bill_id', $bill->id),
            ],
        ], [
            'discountId.unique' => 'That discount is already applied to this bill.',
        ]);

        $discount = Discount::findOrFail($validated['discountId']);

        if (! $discount->is_active) {
            throw ValidationException::withMessages([
                'discountId' => 'That discount is no longer active.',
            ]);
        }

        $bill->adjustments()->create([
            'discount_id' => $discount->id,
            'label' => $discount->name,
            'type' => $discount->type,
            'value' => $discount->value,
            // Fixed/percentage resolve against gross (capped); a full-coverage
            // credit covers whatever balance is left.
            'amount' => $bill->creditFor($discount),
        ]);

        $this->syncDownpaymentWaiver($bill);
        $this->syncInstallmentPlan($bill->fresh(), $generate);
        $bill->recalculate();

        return $this->billResource($bill);
    }

    /**
     * Remove an applied discount from a bill.
     */
    public function destroy(Bill $bill, BillAdjustment $adjustment, GenerateInstallmentSchedule $generate): BillResource
    {
        abort_if($adjustment->bill_id !== $bill->id, 404);

        $adjustment->delete();
        $this->syncDownpaymentWaiver($bill);
        $this->syncInstallmentPlan($bill->fresh(), $generate);
        $bill->recalculate();

        return $this->billResource($bill);
    }

    /**
     * Keep the enrollment's downpayment waiver in sync with the bill's vouchers:
     * a voucher waives the downpayment, removing the last one reinstates it. The
     * installment schedule is rebuilt afterwards against the updated flag.
     */
    private function syncDownpaymentWaiver(Bill $bill): void
    {
        $enrollment = $bill->enrollment;

        if ($enrollment === null) {
            return;
        }

        $waive = $bill->hasVoucher();
        if ((bool) $enrollment->no_downpayment !== $waive) {
            $enrollment->update(['no_downpayment' => $waive]);
        }
    }

    /**
     * Regenerate the installment schedule so it matches the (now changed) net total
     * after a discount is applied or removed. Every bill is installment.
     */
    private function syncInstallmentPlan(Bill $bill, GenerateInstallmentSchedule $generate): void
    {
        $generate($bill);
    }

    private function billResource(Bill $bill): BillResource
    {
        return new BillResource(
            $bill->fresh()->load(['schoolYear', 'enrollment', 'items', 'adjustments', 'installments', 'payments.recorder', 'payments.submitter']),
        );
    }
}
