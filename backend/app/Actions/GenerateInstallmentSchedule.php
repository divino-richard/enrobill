<?php

namespace App\Actions;

use App\Models\Bill;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GenerateInstallmentSchedule
{
    /**
     * Build a bill's installment schedule from its term's policy: a downpayment
     * plus N equal monthly installments covering the remainder. Replaces any
     * existing installments. Throws if the term doesn't offer installments.
     */
    public function __invoke(Bill $bill): void
    {
        $term = $bill->term;

        if ($term === null || ! $term->installments_enabled) {
            throw ValidationException::withMessages([
                'paymentOption' => 'Installments are not available for this term.',
            ]);
        }

        $net = $bill->netTotal();
        $count = max(1, (int) $term->installment_count);

        $downpayment = $term->downpayment_type === 'percentage'
            ? round($net * ((float) $term->downpayment_value / 100), 2)
            : round(min((float) $term->downpayment_value, $net), 2);
        $downpayment = max($downpayment, 0);

        $remaining = round($net - $downpayment, 2);
        $anchor = $term->start_date ? Carbon::parse($term->start_date) : Carbon::today();

        $rows = [];
        $sequence = 1;

        if ($downpayment > 0) {
            $rows[] = [
                'sequence' => $sequence++,
                'label' => 'Downpayment',
                'amount' => $downpayment,
                'due_date' => $anchor->toDateString(),
            ];
        }

        if ($remaining > 0) {
            $base = floor($remaining / $count * 100) / 100;
            $allocated = 0.0;
            for ($i = 1; $i <= $count; $i++) {
                $amount = $i === $count ? round($remaining - $allocated, 2) : $base;
                $allocated = round($allocated + $amount, 2);
                $rows[] = [
                    'sequence' => $sequence++,
                    'label' => 'Installment '.$i,
                    'amount' => $amount,
                    'due_date' => $anchor->copy()->addMonths($i)->toDateString(),
                ];
            }
        }

        DB::transaction(function () use ($bill, $rows) {
            $bill->installments()->delete();
            if ($rows !== []) {
                $bill->installments()->createMany($rows);
            }
        });
    }
}
