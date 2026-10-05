<?php

namespace Tests\Unit;

use App\Services\Currency;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class CurrencyTest extends TestCase
{
    public static function amounts(): array
    {
        return [
            ['0', 0], ['0.004', 0], ['0.005', 1], ['1.005', 101],
            ['2000.015', 200002], ['99999999.99', 9999999999],
            ['-0.005', -1], ['-25.345', -2535], [null, 0], [1522.60, 152260],
        ];
    }

    #[DataProvider('amounts')]
    public function test_currency_is_rounded_once_without_losing_centavos(string|float|null $amount, int $expected): void
    {
        $this->assertSame($expected, Currency::cents($amount));
        $this->assertSame($expected, Currency::cents(Currency::pesos($expected)));
    }
}
