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
  return <section aria-label="Re-enrollment payment requirements" className="rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <CalendarClockIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-sm font-semibold">{dropping ? collectionLabel(bill) : 'Complete re-enrollment'}</h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{pendingReturn && !requirements.eligible ? 'Payments may still be recorded, but this enrollment cannot become active. Review the eligibility issue below.' : pendingReturn
          ? 'Your enrollment stays pending until previous dropping balances are fully settled and the new school year’s payment requirement is met.'
          : 'No immediate payment or clearance is required. You may pay voluntarily; any remaining dropping balance must be settled before re-enrollment becomes active.'}</p>
        {requirements?.returnDeadline && <p className="text-sm">{requirements.eligible ? 'Complete re-enrollment by' : 'Re-enrollment deadline:'} <span className="font-medium">{dateLabel(requirements.returnDeadline)}</span><span className="text-muted-foreground"> · Asia/Manila</span></p>}
        {pendingReturn && <dl className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Previous balance to settle</dt><dd className="mt-1 font-semibold tabular-nums">{formatPeso(requirements.previousBalance!)}</dd></div>
          <div><dt className="text-muted-foreground">New enrollment payment remaining</dt><dd className="mt-1 font-semibold tabular-nums">{requirements.newEnrollmentPayment == null ? 'Bill not generated' : formatPeso(requirements.newEnrollmentPayment)}</dd></div>
        </dl>}
        {student && <Link className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={STUDENT_RETURN_PATH}>View re-enrollment options<ArrowRightIcon className="ml-1 size-4" aria-hidden="true" /></Link>}
        {(requirements?.blockers.length ?? 0) > 0 && <details className="pt-1 text-sm" open={!requirements?.eligible}>
          <summary className="w-fit cursor-pointer font-medium underline-offset-4 hover:underline">{requirements?.eligible ? 'What is preventing activation?' : 'Re-enrollment unavailable'}</summary>
          <ul className="mt-2 max-w-prose list-disc space-y-1 pl-5 text-muted-foreground">{requirements?.blockers.map(issue => <li key={issue}>{issue}</li>)}</ul>
        </details>}
      </div>
    </div>
  </section>;
}

export function DroppingSchedule({ bill }: { bill: Bill }) {
  const rows = bill.historicalInstallments ?? [];
  const arrangement = bill.paymentArrangement;
  return <div className="space-y-4 text-sm">
    <div className="space-y-1"><p className="font-medium">No active payment schedule</p><p className="max-w-prose leading-relaxed text-muted-foreground">Dropping charges have no installment deadlines or overdue status. {collectionLabel(bill)}.</p></div>
    {(rows.length > 0 || arrangement) && <details className="border-t pt-4">
      <summary className="w-fit cursor-pointer font-medium underline-offset-4 hover:underline">Historical schedules</summary>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Retained for reference only. These dates do not require payment or authorize re-enrollment.</p>
      {rows.length > 0 && <ul className="mt-3 divide-y">{rows.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2"><div><p>{row.label}</p><p className="text-xs text-muted-foreground">{row.dueDate ? dateLabel(row.dueDate) : 'No date recorded'}</p></div><span className="tabular-nums">{formatPeso(row.amount)}</span></li>)}</ul>}
      {arrangement && <div className="mt-4 space-y-2"><h3 className="font-medium">Previous payment arrangement</h3><p className="whitespace-pre-wrap text-muted-foreground">{arrangement.remarks}</p><ul className="space-y-2">{arrangement.installments.map((row, i) => <li key={i} className="flex justify-between gap-3"><span>{dateLabel(row.dueDate)}</span><span className="tabular-nums">{formatPeso(row.amount)}</span></li>)}</ul></div>}
    </details>}
  </div>;
}
