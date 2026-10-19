import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, Clock3Icon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appliedCreditLines } from '@/features/bills/credits';
import { nextOutstandingInstallment } from '@/features/bills/utils';
import type { Bill } from '@/features/bills/types';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';

function dateLabel(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00+08:00`);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function DashboardBilling({ bill, today }: { bill: Bill; today: string }) {
  const nextDue = nextOutstandingInstallment(bill.installments ?? []);
  const pending = (bill.payments ?? []).filter(payment => payment.status === 'pending');
  const hasPending = pending.length > 0 || (bill.pendingPaymentCount ?? 0) > 0;
  const pendingAmount = pending.reduce((sum, payment) => sum + payment.amount, 0);
  const settled = bill.balance <= 0;
  const dueDate = nextDue?.dueDate?.slice(0, 10);
  const overdue = !settled && (nextDue?.status === 'overdue' || Boolean(dueDate && dueDate < today));
  const dueToday = !settled && dueDate === today;
  const urgent = !hasPending && (overdue || dueToday);
  const billUrl = `/portal/bills/${bill.id}`;
  const credits = appliedCreditLines(bill, 'Credit applied');
  const heading = hasPending ? 'Payment awaiting verification' : settled ? 'Bill settled' : overdue ? 'Payment overdue' : dueToday ? 'Payment due today' : 'Next payment';
  const Icon = hasPending ? Clock3Icon : settled ? CheckIcon : urgent ? TriangleAlertIcon : null;

  return <section aria-labelledby="student-bill-title" className="overflow-hidden rounded-xl border bg-card">
    <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,1fr)]">
      <div className="min-w-0 p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="student-bill-title" className="text-base font-semibold">Fees &amp; payments</h2>
          {bill.schoolYear && <span className="text-sm text-muted-foreground">SY {bill.schoolYear}</span>}
        </header>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">{bill.droppingAssessment ? 'Final charge' : 'Total fees'}</dt><dd className="font-medium tabular-nums wrap-anywhere">{formatPeso(bill.netTotal)}</dd></div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">Verified payments</dt><dd className="font-medium tabular-nums wrap-anywhere">{formatPeso(bill.amountPaid)}</dd></div>
          {credits.map(credit => <div key={credit.kind} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">{credit.label}</dt><dd className="font-medium tabular-nums wrap-anywhere">{formatPeso(credit.amount)}</dd></div>)}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3"><dt className="font-medium">Remaining balance</dt><dd className="text-xl font-semibold tabular-nums wrap-anywhere">{formatPeso(bill.balance)}</dd></div>
          {(bill.availableCredit ?? 0) > 0 && <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><dt className="text-muted-foreground">Credit for a future enrollment</dt><dd className="tabular-nums wrap-anywhere">{formatPeso(bill.availableCredit!)}</dd></div>}
        </dl>
      </div>
      <div className={cn('flex min-w-0 flex-col justify-between gap-5 border-t p-5 sm:p-6 lg:border-t-0 lg:border-l',
        urgent ? 'bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100' : 'bg-muted/20')}>
        <div className="space-y-2 text-sm">
          <h3 className="flex items-start gap-2 font-semibold">{Icon && <Icon aria-hidden="true" className="size-5 shrink-0" />}{heading}</h3>
          {hasPending ? <>
            {pendingAmount > 0 && <p className="text-xl font-semibold tabular-nums wrap-anywhere">{formatPeso(pendingAmount)} submitted</p>}
            <p className="leading-relaxed text-muted-foreground">Your balance updates after review. Check your submitted payment before sending another.</p>
          </> : settled ? <p className="text-muted-foreground">No remaining balance on this bill.</p> : <>
            <p className="text-2xl font-semibold tabular-nums wrap-anywhere">{formatPeso(bill.amountDue)}</p>
            <p className={urgent ? '' : 'text-muted-foreground'}>{dueDate ? `${overdue ? 'Overdue since' : 'Due'} ${dateLabel(dueDate)}` : 'See your bill for payment details.'}</p>
            {!urgent && dueDate && dueDate > today && <p className="text-muted-foreground">No payment is overdue on this bill.</p>}
          </>}
        </div>
        <Button asChild variant={urgent ? 'default' : 'outline'} className="min-h-11 w-full justify-between whitespace-normal">
          <Link to={hasPending ? `${billUrl}?tab=payments` : billUrl}>{hasPending ? 'View submitted payment' : settled ? 'View statement' : urgent ? 'View bill & pay' : 'View bill'}<ArrowRightIcon aria-hidden="true" className="shrink-0" /></Link>
        </Button>
      </div>
    </div>
    {(bill.previousBalance ?? 0) > 0 && <div className="flex flex-wrap items-center justify-between gap-x-4 border-t px-5 py-2 text-sm sm:px-6">
      <p className="text-muted-foreground">Previous school-year balance: <span className="font-medium text-foreground tabular-nums">{formatPeso(bill.previousBalance!)}</span></p>
      <Button asChild variant="link" className="min-h-11 px-0"><Link to="/portal/bills">View previous bills<ArrowRightIcon aria-hidden="true" /></Link></Button>
    </div>}
  </section>;
}
