<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BillInstallmentController extends Controller
{
    /**
     * Replace a bill's installment schedule. The installments must add up to the
     * bill's net total (gross charges minus credits) so the plan fully covers
     * what the student owes.
     */
    public function update(Request $request, Bill $bill): BillResource
    {
        $validated = $request->validate([
            'installments' => ['present', 'array'],
            'installments.*.label' => ['required', 'string', 'max:100'],
            'installments.*.amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'installments.*.dueDate' => ['required', 'date'],
        ]);

        $net = $bill->netTotal();
        $sum = round(collect($validated['installments'])->sum('amount'), 2);

        if ($validated['installments'] !== [] && abs($sum - $net) > 0.01) {
            throw ValidationException::withMessages([
                'installments' => "The installments must add up to the net total of {$net}. They currently total {$sum}.",
            ]);
        }

        DB::transaction(function () use ($bill, $validated) {
            $bill->installments()->delete();

            $sequence = 1;
            foreach ($validated['installments'] as $installment) {
                $bill->installments()->create([
                    'sequence' => $sequence++,
                    'label' => $installment['label'],
                    'amount' => $installment['amount'],
                    'due_date' => $installment['dueDate'],
                ]);
            }
        });

        return new BillResource(
            $bill->fresh()->load(['term', 'items', 'adjustments', 'installments', 'payments.recorder']),
        );
    }
}
