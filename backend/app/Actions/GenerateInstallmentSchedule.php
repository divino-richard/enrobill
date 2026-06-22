<?php

namespace App\Actions;

use App\Models\Bill;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class GenerateInstallmentSchedule
{
    /**
     * Build a bill's installment schedule from its school year's policy: a
     * downpayment plus N equal monthly installments covering the remainder. The
     * downpayment is waived when the enrollment is flagged `no_downpayment` (e.g.
     * a private-school graduate). Replaces any existing installments.
     */
    public function __invoke(Bill $bill): void
    {
        $schoolYear = $bill->schoolYear;
        $net = $bill->netTotal();
        $count = max(1, (int) ($schoolYear?->installment_count ?? 1));

        $waiveDownpayment = (bool) ($bill->enrollment?->no_downpayment);

        $downpayment = 0.0;
        if (! $waiveDownpayment && $schoolYear !== null) {
            $downpayment = $schoolYear->downpayment_type === 'percentage'
                ? round($net * ((float) $schoolYear->downpayment_value / 100), 2)
                : round(min((float) $schoolYear->downpayment_value, $net), 2);
            $downpayment = max($downpayment, 0);
        }

        $remaining = round($net - $downpayment, 2);
        $anchor = $schoolYear?->start_date ? Carbon::parse($schoolYear->start_date) : Carbon::today();

        $rows = [];
        $sequence = 1;

        if ($downpayment > 0) {
            $rows[] = [
                'sequence' => $sequence++,
                'label' => Bill::DOWNPAYMENT_LABEL,
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
