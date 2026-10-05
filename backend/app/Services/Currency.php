<?php

namespace App\Services;

/** Money arithmetic stays in integer centavos; JSON amounts use peso decimals. */
final class Currency
{
    public static function cents(string|int|float|null $value): int
    {
        $text = is_float($value) ? number_format($value, 2, '.', '') : (string) ($value ?? '0');
        $negative = str_starts_with($text, '-');
        $text = ltrim($text, '-+');
        [$whole, $fraction] = array_pad(explode('.', $text, 2), 2, '');
        $fraction = str_pad($fraction, 3, '0');
        $cents = ((int) $whole * 100) + (int) substr($fraction, 0, 2);
        if ((int) $fraction[2] >= 5) {
            $cents++;
        }

        return $negative ? -$cents : $cents;
    }

    public static function pesos(int $cents): float
    {
        return $cents / 100;
    }

    public static function half(int $cents): int
    {
        return intdiv($cents + 1, 2);
    }
}
