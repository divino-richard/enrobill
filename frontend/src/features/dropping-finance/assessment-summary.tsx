import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, CircleAlertIcon, CircleCheckIcon, ChevronRightIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';
import type { DroppingRequest } from '@/features/dropping/api';
import { fetchAssessment, PERIODS, philippinesToday, type AssessmentBlocker, type DroppingAssessment } from './api';

const recovery: Record<AssessmentBlocker['category'], { title: string; description: string; action?: string }> = {
  policy: { title: 'Configure the dropping policy', description: 'Set the school-year periods and enable the policy in Academic Years.', action: 'Open academic years' },
  bill: { title: 'Generate the original bill', description: 'Create the enrollment’s bill before calculating the dropping charge.', action: 'Open enrollments' },
  fees: { title: 'Review the original fees', description: 'Classify each fee and check that the original charges match the bill total.', action: 'Review bill fees' },
  payments: { title: 'Review pending payments', description: 'Verify or reject pending payments so the balance is up to date.', action: 'Review payments' },
  date: { title: 'Choose an effective date', description: 'Select a valid date within the school’s dropping periods when you review the approval.' },
  eligibility: { title: 'Check enrollment eligibility', description: 'Dropping charges are currently available for senior high school enrollments only.' },
  legacy: { title: 'Historical approval', description: 'This request was approved before dropping charges were enabled.' },
};

function AssessmentIssues({ assessment, billId, canConfigure }: { assessment: DroppingAssessment; billId?: number | null; canConfigure: boolean }) {
  const hasPolicyIssue = assessment.blockingIssues?.some(issue => issue.category === 'policy');
  const groups = assessment.blockingIssues?.filter(issue => !(hasPolicyIssue && issue.category === 'date')) ?? [];
  const dateOnly = groups.length === 1 && groups[0].category === 'date';
  return <div className="space-y-4">
    <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" role="status">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{dateOnly ? 'Effective date needed' : 'Not ready for approval'}</p>
        <p className="text-xs leading-relaxed">{dateOnly ? 'Choose an effective date to calculate the final charge.' : 'Resolve the items below to calculate the dropping charge.'}</p>
      </div>
    </div>
    {groups.length > 0 ? <ul className="divide-y">
      {groups.map(issue => {
        const item = recovery[issue.category];
        const href = issue.category === 'policy' ? (canConfigure ? '/admin/terms' : null)
          : issue.category === 'bill' ? '/admin/enrollments'
          : ['fees', 'payments'].includes(issue.category) && billId ? `/admin/billing/${billId}` : null;
        return <li key={issue.category} className="space-y-1.5 py-4 first:pt-0 last:pb-0">
          <p className="text-sm font-medium">{item?.title ?? 'Review calculation issue'}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{issue.category === 'policy' && !canConfigure ? 'Ask an administrator to configure and enable this school year’s dropping policy.' : item?.description ?? issue.messages.join(' ')}</p>
          {href && <Link to={href} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{item.action}<ArrowUpRightIcon className="size-3.5" aria-hidden="true" /></Link>}
        </li>;
      })}
    </ul> : <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">{assessment.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    {groups.length > 0 && <details className="group border-t pt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer py-1.5 font-medium underline-offset-4 hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Calculation details ({assessment.issues.length})</summary>
      <ul className="mt-2 list-disc space-y-2 pl-4 leading-relaxed">{assessment.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    </details>}
  </div>;
}

export function AssessmentSummary({ assessment, estimated = false, staff = false, current, billId, canConfigure = false, compact = false }: {
  assessment: DroppingAssessment;
  estimated?: boolean;
  staff?: boolean;
  current?: DroppingRequest['financialSummary'];
  billId?: number | null;
  canConfigure?: boolean;
  compact?: boolean;
}) {
  if (assessment.legacy) return <p className="text-sm leading-relaxed text-muted-foreground">This request was approved before the dropping-charge policy. Its original bill remains unchanged.</p>;
  if (compact) {
    const ready = (assessment.ready || assessment.finalized) && assessment.finalCharge !== null;
    const dateOnly = assessment.blockingIssues?.length === 1 && assessment.blockingIssues[0].category === 'date';
    return <div className="space-y-5">
      {staff && assessment.category && <dl className="text-sm"><div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">Fee policy</dt><dd className="text-right">{assessment.category === 'voucher_esc' ? 'Voucher / ESC' : 'Paying'}{!assessment.finalized && <span className="ml-1.5 text-xs text-muted-foreground">· Automatic</span>}</dd></div></dl>}
      <dl className="space-y-4 border-t pt-5 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">{estimated ? 'Estimated charge' : 'Dropping charge'}</dt><dd className="font-medium tabular-nums">{ready ? formatPeso(assessment.finalCharge!) : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200"><CircleAlertIcon className="size-3.5" aria-hidden="true" />{dateOnly ? 'Date needed' : staff ? 'Setup required' : 'Pending review'}</span>}</dd></div>
        {ready && estimated && <div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">Balance after dropping</dt><dd className="font-semibold tabular-nums">{formatPeso(current?.balance ?? assessment.balance)}</dd></div>}
        {ready && (current?.creditIssued ?? assessment.credit ?? 0) > 0 && <div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">Student credit</dt><dd className="font-medium tabular-nums">{formatPeso(current?.creditIssued ?? assessment.credit ?? 0)}</dd></div>}
      </dl>
      {ready ? <details className="group/charge text-sm"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><ChevronRightIcon className="size-3.5 group-open/charge:rotate-90" aria-hidden="true" />Calculation details</summary><div className="border-t pt-4"><AssessmentSummary assessment={assessment} estimated={estimated} staff={staff} current={current} billId={billId} canConfigure={canConfigure} /></div></details> : <p role="status" className="text-xs leading-relaxed text-muted-foreground">{dateOnly ? 'Choose the effective date during approval.' : staff ? 'Financial setup is required before approval.' : 'The school will confirm the final charge.'}</p>}
    </div>;
  }
  const policyNote = staff && !assessment.finalized && assessment.category ? <div className="space-y-1.5 border-b pb-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="font-medium">{assessment.category === 'voucher_esc' ? 'Voucher / ESC policy' : 'Paying policy'}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CircleCheckIcon className="size-3.5" aria-hidden="true" />Automatic</span>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{assessment.category === 'voucher_esc' ? 'A voucher is recorded on this enrollment’s bill.' : 'No voucher is recorded on this enrollment’s bill.'}</p>
  </div> : null;
  if ((!assessment.ready && !assessment.finalized) || assessment.finalCharge === null) {
    return <div className="space-y-4">
      {policyNote}
      {staff ? <AssessmentIssues assessment={assessment} billId={billId} canConfigure={canConfigure} /> : <div className="space-y-1 text-sm" role="status"><p className="font-medium">Estimate not yet available</p><p className="leading-relaxed text-muted-foreground">The school will confirm your dropping charge when it approves your request.</p></div>}
    </div>;
  }
  const credit = current?.creditIssued ?? assessment.credit ?? 0;
  const creditApplied = current?.creditApplied ?? assessment.creditApplied ?? 0;
  return <div className="space-y-4">
    {policyNote}
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{estimated ? 'Estimated dropping charge' : 'Dropping assessment'}</h3>
      <p className="text-xs text-muted-foreground">{PERIODS.find(p => p.key === assessment.period)?.label}{assessment.finalized && ` · ${assessment.category === 'voucher_esc' ? 'Voucher / ESC' : 'Paying'}`}</p>
    </div>
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-4 text-muted-foreground"><dt>Original assessment</dt><dd className="tabular-nums">{formatPeso(assessment.originalTotal)}</dd></div>
      <div className="flex justify-between gap-4 font-semibold"><dt>{estimated ? 'Policy charge' : 'Final charge'}</dt><dd className="tabular-nums">{formatPeso(assessment.finalCharge)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Verified payments</dt><dd className="tabular-nums">{formatPeso(current?.verifiedPayments ?? assessment.verifiedPayments)}</dd></div>
      {creditApplied > 0 && <div className="flex justify-between gap-4"><dt>Student credit used</dt><dd className="tabular-nums">{formatPeso(creditApplied)}</dd></div>}
      <div className="flex justify-between gap-4 border-t pt-3 font-semibold"><dt>{estimated ? 'Balance after dropping' : 'Current balance'}</dt><dd className="tabular-nums">{formatPeso(current?.balance ?? assessment.balance)}</dd></div>
      {credit > 0 && <div className="flex justify-between gap-4"><dt>{estimated ? 'Credit for a future enrollment' : 'Student credit issued'}</dt><dd className="tabular-nums">{formatPeso(credit)}</dd></div>}
      {current && credit > 0 && <div className="flex justify-between gap-4 text-muted-foreground"><dt>Available student credit</dt><dd className="tabular-nums">{formatPeso(current.availableCredit)}</dd></div>}
    </dl>
    {!!assessment.feeCharges?.length && <details className="border-t pt-3 text-sm"><summary className="cursor-pointer py-2 font-medium">Selected fee charges ({assessment.feeCharges.length})</summary><ul className="divide-y">{assessment.feeCharges.map(item => <li key={item.billItemId} className="flex justify-between gap-4 py-2"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{item.percent}% of {formatPeso(item.originalAmount)}</span></li>)}</ul></details>}
    {estimated && <p className="text-xs leading-relaxed text-muted-foreground">Estimate as of {new Date(`${assessment.effectiveDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}. The effective dropping date determines the final charge.</p>}
  </div>;
}

export function RequestAssessment({ requestId, final, current, staff, billId, active, canConfigure = false, compact = false }: {
  requestId: number;
  final?: DroppingAssessment | null;
  current?: DroppingRequest['financialSummary'];
  staff: boolean;
  billId: number | null;
  active: boolean;
  canConfigure?: boolean;
  compact?: boolean;
}) {
  const date = philippinesToday();
  const query = useQuery({ queryKey: ['dropping-assessment', requestId, date], queryFn: () => fetchAssessment(requestId, date), enabled: !final && active });
  if (!final && !active) return null;
  return <section className="space-y-4" aria-label="Dropping charges">
    {final ? <AssessmentSummary compact={compact} assessment={final} current={current} staff={staff} /> : query.isPending ? <div className="space-y-3" role="status"><span className="sr-only">Calculating estimated charge…</span><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-24 w-full" /></div> : query.isError ? <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{getErrorMessage(query.error)}</p><Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCwIcon />Retry calculation</Button></div> : query.data && <AssessmentSummary compact={compact} assessment={query.data} estimated staff={staff} billId={billId} canConfigure={canConfigure} />}
  </section>;
}
