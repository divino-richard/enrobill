import { STUDENT_RETURN_PATH } from '@/features/re-enrollment/presentation';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarClockIcon } from 'lucide-react';
import type { Bill } from '@/features/bills/types';
import { collectionLabel, isDroppingBill } from '@/features/bills/collection';
import { formatPeso } from '@/lib/money';

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
}).format(new Date(`${date}T00:00:00+08:00`));

export function BillCollectionNotice({ bill, student = false }: { bill: Bill; student?: boolean }) {
  const dropping = isDroppingBill(bill);
  const requirements = bill.returnRequirements;
  if (!dropping && !requirements) return null;
  const pendingReturn = requirements?.previousBalance != null;
  const eligible = requirements?.eligible !== false;
  const previousUnpaid = (requirements?.previousBalance ?? bill.balance) > 0;
  const title = !eligible ? 'Re-enrollment needs attention'
    : dropping && bill.balance === 0 ? 'Dropping balance settled'
    : dropping ? collectionLabel(bill) : 'Complete re-enrollment';
  const description = !eligible
    ? 'Payments remain voluntary and do not resolve the eligibility issue below.'
    : dropping && bill.balance === 0
      ? 'This bill is settled. Check My Program for the next step in re-enrollment.'
      : pendingReturn && previousUnpaid
        ? 'Settle the previous dropping balance first. Only verified payments and applied credits count toward re-enrollment.'
        : pendingReturn
          ? requirements.newEnrollmentPayment == null
            ? 'The previous balance is settled. Wait for the cashier to generate the new school-year bill.'
            : 'Meet the new bill’s enrollment payment requirement to become enrolled.'
          : 'No immediate payment or clearance is required. Settle the remaining balance before starting re-enrollment; payments must be verified first.';
  return <section aria-label="Re-enrollment payment requirements" className="rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
        {requirements?.returnDeadline && <p className="text-xs text-muted-foreground">{eligible ? 'Complete re-enrollment by' : 'Return deadline:'} <span className="font-medium text-foreground">{dateLabel(requirements.returnDeadline)}</span></p>}
        {student && <Link className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={STUDENT_RETURN_PATH}>View re-enrollment options<ArrowRightIcon className="ml-1 size-4" aria-hidden="true" /></Link>}
        {(requirements?.blockers.length ?? 0) > 0 && <details className="pt-1 text-sm" open={!eligible}>
          <summary className="w-fit cursor-pointer py-1 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{eligible ? 'What is needed for re-enrollment?' : 'Review eligibility issue'}</summary>
          <ul className="mt-2 max-w-prose list-disc space-y-1 pl-5 text-muted-foreground">{requirements?.blockers.map(issue => <li key={issue}>{issue}</li>)}</ul>
        </details>}
      </div>
    </div>
  </section>;
}

export function DroppingSchedule({ bill, historyOnly = false }: { bill: Bill; historyOnly?: boolean }) {
  const rows = bill.historicalInstallments ?? [];
  const arrangement = bill.paymentArrangement;
  if (historyOnly && rows.length === 0 && !arrangement) return null;
  return <div className="space-y-4 text-sm">
    {!historyOnly && <div className="space-y-1"><p className="font-medium">No active payment schedule</p><p className="max-w-prose leading-relaxed text-muted-foreground">Dropping charges have no installment deadlines or overdue status. {collectionLabel(bill)}.</p></div>}
    {(rows.length > 0 || arrangement) && <details className={historyOnly ? 'rounded-lg border px-4' : 'border-t pt-4'}>
      <summary className="cursor-pointer py-3 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Past payment schedules</summary>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">For reference only. These dates no longer require payment.</p>
      {rows.length > 0 && <ul className="mt-3 divide-y">{rows.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2"><div><p>{row.label}</p><p className="text-xs text-muted-foreground">{row.dueDate ? dateLabel(row.dueDate) : 'No date recorded'}</p></div><span className="tabular-nums">{formatPeso(row.amount)}</span></li>)}</ul>}
      {arrangement && <div className="mt-4 space-y-2"><h3 className="font-medium">Previous payment arrangement</h3><p className="whitespace-pre-wrap text-muted-foreground">{arrangement.remarks}</p><ul className="space-y-2">{arrangement.installments.map((row, i) => <li key={i} className="flex justify-between gap-3"><span>{dateLabel(row.dueDate)}</span><span className="tabular-nums">{formatPeso(row.amount)}</span></li>)}</ul></div>}
    </details>}
  </div>;
}
