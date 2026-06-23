<?php

namespace App\Support;

/**
 * The default Senior High School fee schedule, transcribed from Northlink's
 * official "Schedule of Fees" (SY 2023-2024). Amounts are starting defaults that
 * admins adjust per school year (tuition in particular changes year to year).
 * Every item applies to all year levels as a base (`default`) charge; Grade 12
 * add-ons are layered on per year by the admin.
 *
 * Section totals on the source sheet: Tuition 12,561.25 · Miscellaneous 3,795.00
 * · Other 2,065.00 · Grand total 18,421.25.
 */
class FeeScheduleTemplate
{
    /**
     * @var list<array{category: string, name: string, amount: float}>
     */
    public const ITEMS = [
        // Tuition
        ['category' => 'tuition', 'name' => 'Tuition Fee', 'amount' => 12561.25],

        // Miscellaneous Fees
        ['category' => 'miscellaneous', 'name' => 'Registration', 'amount' => 500.00],
        ['category' => 'miscellaneous', 'name' => 'Medical/Dental Fee', 'amount' => 300.00],
        ['category' => 'miscellaneous', 'name' => 'Athletics', 'amount' => 250.00],
        ['category' => 'miscellaneous', 'name' => 'Guidance and Counselling Fee', 'amount' => 125.00],
        ['category' => 'miscellaneous', 'name' => 'School Publication', 'amount' => 80.00],
        ['category' => 'miscellaneous', 'name' => 'Student Organization', 'amount' => 100.00],
        ['category' => 'miscellaneous', 'name' => 'Audio Visual', 'amount' => 100.00],
        ['category' => 'miscellaneous', 'name' => 'Library Fee', 'amount' => 300.00],
        ['category' => 'miscellaneous', 'name' => 'Laboratory Fee', 'amount' => 1600.00],
        ['category' => 'miscellaneous', 'name' => 'Science Laboratory', 'amount' => 350.00],
        ['category' => 'miscellaneous', 'name' => 'Insurance', 'amount' => 90.00],

        // Other Fees
        ['category' => 'other', 'name' => 'Handbook', 'amount' => 90.00],
        ['category' => 'other', 'name' => 'Student Identification Card', 'amount' => 150.00],
        ['category' => 'other', 'name' => 'Internet Fee', 'amount' => 335.00],
        ['category' => 'other', 'name' => 'Testing Materials', 'amount' => 130.00],
        ['category' => 'other', 'name' => 'Energy Fee', 'amount' => 330.00],
        ['category' => 'other', 'name' => 'Grades Mailing Fee', 'amount' => 40.00],
        ['category' => 'other', 'name' => "Physical/Facilities Dev't", 'amount' => 450.00],
        ['category' => 'other', 'name' => "Student Dev't Fund", 'amount' => 150.00],
        ['category' => 'other', 'name' => 'NSTP/Community Extension', 'amount' => 390.00],
    ];

    /**
     * The template as rows ready for SchoolYear::fees()->createMany(): every item
     * is an `all`-level `default` fee, sequenced in schedule order.
     *
     * @return list<array<string, mixed>>
     */
    public static function rows(): array
    {
        $rows = [];
        $sequence = 0;

        foreach (self::ITEMS as $item) {
            $rows[] = [
                'year_level' => 'all',
                'category' => $item['category'],
                'name' => $item['name'],
                'type' => 'default',
                'amount' => $item['amount'],
                'sequence' => ++$sequence,
            ];
        }

        return $rows;
    }
}
