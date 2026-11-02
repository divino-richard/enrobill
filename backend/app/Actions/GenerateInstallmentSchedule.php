<?php

namespace App\Actions;

use App\Models\Bill;
use App\Support\InstallmentAmounts;
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
        if ($bill->isDroppingBill()) {
            return; // Preserve the historical schedule; no active dropping installments.
        }
        $bill->assertMutableAssessment();
        $schoolYear = $bill->schoolYear;
        $net = $bill->netTotal();
        $count = max(1, (int) ($schoolYear?->installment_count ?? 1));

        $waiveDownpayment = (bool) ($bill->enrollment?->no_downpayment);

        $amounts = InstallmentAmounts::calculate($net, $waiveDownpayment ? 0 : (float) ($schoolYear?->downpayment_value ?? 0), $count);
        $downpayment = $amounts['downpayment'];
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

        foreach ($amounts['installments'] as $index => $amount) {
            $i = $index + 1;
            $rows[] = [
                'sequence' => $sequence++,
                'label' => 'Installment '.$i,
                'amount' => $amount,
                'due_date' => $anchor->copy()->addMonths($i)->toDateString(),
            ];
        }

        DB::transaction(function () use ($bill, $rows) {
            $bill->installments()->delete();
            if ($rows !== []) {
                $bill->installments()->createMany($rows);
            }
        });
    }
}
