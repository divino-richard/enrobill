import type { ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import type { Bill } from '../types';
import { approvedChargeLines, droppingAssessmentContext } from '../dropping-statement';
import { formatBillDate } from '../staff-billing';
import { formatPeso } from '@/lib/money';
import { cn } from '@/lib/utils';
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

export function DroppingBillStatement({ bill, columns = false, showApprovalDetails = true, showCreditHistoryLink = true, summaryFooter, className }: { bill: StatementRecord; columns?: boolean; showApprovalDetails?: boolean; showCreditHistoryLink?: boolean; summaryFooter?: ReactNode; className?: string }) {
  const assessment = bill.droppingAssessment;
  const rows = approvedChargeLines(bill);
  return <div className={cn('text-sm', columns ? 'grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]' : 'space-y-5 p-4 sm:p-6', className)}>
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
    {(bill.creditIssued ?? 0) > 0 && <p className="text-xs leading-relaxed text-muted-foreground">{formatPeso(bill.creditIssued!)} from excess payments was issued as student credit.{showCreditHistoryLink && ' View your bill’s history for credit allocations.'}</p>}
    {summaryFooter}
    </div>
  </div>;
}

export function DroppingBillHistory({ bill, staff = false }: { bill: Bill; staff?: boolean }) {
  if (staff) return <StaffBillingHistory bill={bill} />;
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
    {(!!bill.historicalInstallments?.length || !!bill.paymentArrangement) && <section><DroppingSchedule bill={bill} historyOnly /></section>}
    <BillFinanceSummary bill={bill} historyOnly />
  </div>;
}

function HistorySection({ title, count, total, children }: { title: string; count: string; total?: number; children: ReactNode }) {
  return <details className="group">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium break-words">{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </span>
      {total !== undefined && <span className="shrink-0 font-medium tabular-nums">{formatPeso(total)}</span>}
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-open:rotate-90" />
    </summary>
    <div className="border-t px-4 py-3">{children}</div>
  </details>;
}

function StaffBillingHistory({ bill }: { bill: Bill }) {
  const adjustments = bill.adjustments ?? [];
  const installments = bill.historicalInstallments ?? [];
  const arrangement = bill.paymentArrangement;
  const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  return <div className="divide-y text-sm">
    {bill.items.length > 0 ? <HistorySection title="Original fees" count={countLabel(bill.items.length, 'item')} total={bill.total}>
      <dl className="divide-y">{bill.items.map((item, index) => <AmountRow key={item.id ?? index} label={item.name} amount={item.amount} />)}</dl>
    </HistorySection> : <p className="px-4 py-3 text-muted-foreground">No original fees recorded.</p>}
    {adjustments.length > 0 && <HistorySection title="Original discounts" count={countLabel(adjustments.length, 'item')}>
      <dl className="divide-y">{adjustments.map(item => <AmountRow key={item.id} label={item.label} amount={-item.amount} />)}</dl>
    </HistorySection>}
    {installments.length > 0 && <HistorySection title="Past installment schedule" count={countLabel(installments.length, 'installment')}>
      <ul className="divide-y">{installments.map(item => <li key={item.id} className="flex items-start justify-between gap-4 py-2">
        <div className="min-w-0"><p className="break-words">{item.label}</p><p className="text-xs text-muted-foreground">{item.dueDate ? formatBillDate(item.dueDate) : 'No date recorded'}</p></div>
        <span className="shrink-0 tabular-nums">{formatPeso(item.amount)}</span>
      </li>)}</ul>
    </HistorySection>}
    {arrangement && <HistorySection title="Previous payment arrangement" count={countLabel(arrangement.installments.length, 'installment')}>
      {arrangement.remarks && <p className="mb-3 whitespace-pre-wrap break-words text-muted-foreground">{arrangement.remarks}</p>}
      <ul className="divide-y">{arrangement.installments.map((item, index) => <li key={index} className="flex items-baseline justify-between gap-4 py-2">
        <span>{formatBillDate(item.dueDate)}</span><span className="shrink-0 tabular-nums">{formatPeso(item.amount)}</span>
      </li>)}</ul>
    </HistorySection>}
  </div>;
}
