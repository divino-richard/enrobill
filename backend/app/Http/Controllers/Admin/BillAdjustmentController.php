<?php

namespace App\Http\Controllers\Admin;

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
    public function store(Request $request, Bill $bill): BillResource
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
            // Resolve against gross charges, capped so credits never exceed them.
            'amount' => $discount->resolveAmount((float) $bill->total),
        ]);

        $bill->recalculate();

        return $this->billResource($bill);
    }

    /**
     * Remove an applied discount from a bill.
     */
    public function destroy(Bill $bill, BillAdjustment $adjustment): BillResource
    {
        abort_if($adjustment->bill_id !== $bill->id, 404);

        $adjustment->delete();
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
