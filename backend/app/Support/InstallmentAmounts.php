<?php

namespace App\Support;

class InstallmentAmounts
{
    /** @return array{downpayment: float, installments: list<float>} */
    public static function calculate(float $total, float $downpayment, int $count): array
    {
        $totalCents = max(0, (int) round($total * 100));
        $downCents = min($totalCents, max(0, (int) round($downpayment * 100)));
        $remaining = $totalCents - $downCents;
        $count = max(1, $count);
        $installments = [];
        if ($remaining > 0) {
            $base = intdiv($remaining, $count);
            for ($i = 1; $i <= $count; $i++) {
                $installments[] = ($i === $count ? $remaining - $base * ($count - 1) : $base) / 100;
            }
        }

        return ['downpayment' => $downCents / 100, 'installments' => $installments];
    }
}
