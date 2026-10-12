import type { ReactNode } from 'react';
import type { Bill } from '../types';
import { approvedChargeLines, droppingAssessmentContext } from '../dropping-statement';
import { formatPeso } from '@/lib/money';
import { formatDate } from '@/features/applications/utils';
import { DroppingSchedule } from '@/features/dropping-finance/collection-notice';
import { BillFinanceSummary } from '@/features/dropping-finance/bill-finance';

function AmountRow({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return <div className={`flex items-baseline justify-between gap-6 py-2 ${strong ? 'border-t pt-4 font-semibold' : ''}`}>
    <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
    <dd className="shrink-0 tabular-nums">{formatPeso(amount)}</dd>
  </div>;
}

type StatementRecord = Pick<Bill, 'droppingAssessment' | 'netTotal' | 'amountPaid' | 'balance' | 'creditApplied' | 'creditIssued'>;

export function DroppingBillStatement({ bill, columns = false, showApprovalDetails = true, summaryFooter }: { bill: StatementRecord; columns?: boolean; showApprovalDetails?: boolean; summaryFooter?: ReactNode }) {
  const assessment = bill.droppingAssessment;
  const rows = approvedChargeLines(bill);
  return <div className={`text-sm ${columns ? 'grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]' : 'space-y-5 p-4 sm:p-6'}`}>
    <div className={columns ? 'min-w-0 space-y-5 p-5 sm:p-6' : 'space-y-5'}>
    <div className="space-y-1">
      <p className="font-medium">{droppingAssessmentContext(bill)}</p>
      {showApprovalDetails && assessment && <p className="text-xs text-muted-foreground">Effective {formatDate(assessment.effectiveDate)}{assessment.policyVersion != null && ` · Approved policy v${assessment.policyVersion}`}</p>}
    </div>
    {rows.length ? <>
      {columns && <div aria-hidden="true" className="flex justify-between gap-4 border-b pb-3 text-xs font-medium text-muted-foreground"><span>Fee</span><span>Charge</span></div>}
      <dl className="divide-y">
      {rows.map((row, index) => <div key={index} className="flex items-start justify-between gap-6 py-3 first:pt-0">
        <dt className="min-w-0 space-y-1"><p className="font-medium break-words">{row.name}</p><p className="text-xs text-muted-foreground">{row.percent}% of {formatPeso(row.base)}</p></dt>
        <dd className="shrink-0 font-medium tabular-nums">{formatPeso(row.amount)}</dd>
      </div>)}
    </dl></> : <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{assessment
      ? 'The approved total is recorded below. An itemized breakdown was not retained with this approval; contact the school for details.'
      : 'This drop has no saved charge assessment. The original enrollment balance is retained; contact the school to review the charge basis.'}</p>}
    </div>
    <div className={columns ? 'min-w-0 space-y-5 border-t bg-muted/35 p-5 sm:p-6 lg:border-l lg:border-t-0' : 'space-y-4'}>
    <dl className={columns ? '[&>div:last-child]:text-base' : 'border-t pt-3'}>
      <AmountRow label={assessment ? 'Approved dropping charge' : 'Recorded assessment'} amount={bill.netTotal} />
      <AmountRow label="Verified payments" amount={-bill.amountPaid} />
      {(bill.creditApplied ?? 0) > 0 && <AmountRow label="Applied student credit" amount={-(bill.creditApplied ?? 0)} />}
      <AmountRow label="Remaining balance" amount={bill.balance} strong />
    </dl>
    {(bill.creditIssued ?? 0) > 0 && <p className="text-xs leading-relaxed text-muted-foreground">{formatPeso(bill.creditIssued!)} from excess payments was issued as student credit. View your bill’s history for credit allocations.</p>}
    {summaryFooter}
    </div>
  </div>;
}

export function DroppingBillHistory({ bill, staff = false }: { bill: Bill; staff?: boolean }) {
  return <div className="space-y-6 text-sm">
    <section className="space-y-3" aria-label="Original enrollment assessment">
      <div className="space-y-1"><h3 className="font-semibold">Original enrollment assessment</h3><p className="max-w-prose text-muted-foreground">{bill.droppingAssessment ? 'These fees are retained for reference. They are not additional dropping charges.' : 'Original fees recorded before the drop.'}</p></div>
      <details className="rounded-lg border px-4">
        <summary className="cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-ring">View original fees ({bill.items.length}) · {formatPeso(bill.total)}</summary>
        <dl className="divide-y pb-3">{bill.items.map((item, index) => <AmountRow key={item.id ?? index} label={item.name} amount={item.amount} />)}</dl>
      </details>
      {!!bill.adjustments?.length && <details className="rounded-lg border px-4">
        <summary className="cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-ring">Original vouchers and incentives</summary>
        <p className="pb-2 text-xs text-muted-foreground">Historical awards are not deducted from the approved dropping charge.</p>
        <dl className="pb-3">{bill.adjustments.map(item => <AmountRow key={item.id} label={item.label} amount={item.amount} />)}</dl>
      </details>}
    </section>
    {(staff || !!bill.historicalInstallments?.length || !!bill.paymentArrangement) && <section className={staff ? 'border-t pt-5' : undefined}><DroppingSchedule bill={bill} historyOnly={!staff} /></section>}
    <BillFinanceSummary bill={bill} staff={staff} historyOnly />
  </div>;
}
