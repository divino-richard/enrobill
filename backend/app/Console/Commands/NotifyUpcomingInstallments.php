<?php

namespace App\Console\Commands;

use App\Actions\NotifyStudent;
use App\Models\BillInstallment;
use Illuminate\Console\Command;

/**
 * Daily reminder for installments coming due soon. `dedupeKey` on
 * NotifyStudent keeps this from re-notifying for the same installment on
 * every run — a fresh reminder appears only once per installment.
 */
class NotifyUpcomingInstallments extends Command
{
    protected $signature = 'notifications:installments-due';

    protected $description = 'Notify students whose next installment is due within a few days.';

    private const DAYS_AHEAD = 3;

    public function handle(NotifyStudent $notify): int
    {
        $today = now()->toDateString();
        $windowEnd = now()->addDays(self::DAYS_AHEAD)->toDateString();

        $installments = BillInstallment::query()
            ->whereDate('due_date', '>=', $today)
            ->whereDate('due_date', '<=', $windowEnd)
            ->whereHas('bill', fn ($q) => $q->where('status', '!=', 'paid'))
            ->with('bill.student')
            ->get();

        $notified = 0;

        foreach ($installments as $installment) {
            $student = $installment->bill?->student;

            if ($student === null) {
                continue;
            }

            $result = $notify(
                $student,
                'billing',
                'Installment due soon',
                "Your \"{$installment->label}\" installment of ₱".number_format((float) $installment->amount, 2)
                    .' is due on '.$installment->due_date->format('M j, Y').'.',
                ctaLabel: 'View bill',
                ctaUrl: '/portal/bills',
                actionRequired: true,
                dedupeKey: "installment-due:{$installment->id}",
            );

            if ($result->wasRecentlyCreated) {
                $notified++;
            }
        }

        $this->info("Notified {$notified} student(s) of upcoming installments.");

        return self::SUCCESS;
    }
}
