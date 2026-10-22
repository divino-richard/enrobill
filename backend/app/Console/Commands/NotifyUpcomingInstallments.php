<?php

namespace App\Console\Commands;

use App\Actions\NotifyStudent;
use App\Models\Bill;
use App\Services\ReferralPaymentGuard;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

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
        $today = now('Asia/Manila')->toDateString();
        $windowEnd = now('Asia/Manila')->addDays(self::DAYS_AHEAD)->toDateString();
        $notified = 0;
        $bills = Bill::where('status', '!=', 'paid')->with(['student', 'installments', 'droppingAssessment', 'adjustments'])->lazyById();
        foreach ($bills as $bill) {
            if (! $bill->student || $bill->balance() <= 0 || app(ReferralPaymentGuard::class)->forBill($bill) !== null) {
                continue;
            }
            foreach ($bill->installmentSchedule() as $row) {
                if ($row['balance'] <= 0 || ! $row['dueDate'] || $row['dueDate'] < $today || $row['dueDate'] > $windowEnd) {
                    continue;
                }
                $dueDate = Carbon::parse($row['dueDate'])->format('M j, Y');
                $key = $row['id'] < 0 ? "arrangement-due:{$bill->id}:{$row['id']}:{$row['dueDate']}" : "installment-due:{$row['id']}";
                $result = $notify(
                    $bill->student, 'billing', 'Installment due soon',
                    "Your \"{$row['label']}\" installment has ₱".number_format($row['balance'], 2).' due on '.$dueDate.'.',
                    ctaLabel: 'View bill', ctaUrl: '/portal/bills/'.$bill->id,
                    actionRequired: true, dedupeKey: $key,
                );
                if ($result->wasRecentlyCreated) {
                    $notified++;
                }
            }
        }

        $this->info("Notified {$notified} student(s) of upcoming installments.");

        return self::SUCCESS;
    }
}
