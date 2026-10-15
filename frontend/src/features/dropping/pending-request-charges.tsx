import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { assessmentChargeLines } from '@/features/bills/dropping-statement';
import { PERIODS, type DroppingAssessment } from '@/features/dropping-finance/api';
import { formatPeso } from '@/lib/money';

export function PendingRequestCharges({ assessment, loading, failed, onRetry, staff = false, actions, setupAction }: {
  assessment?: DroppingAssessment;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  staff?: boolean;
  actions?: ReactNode;
  setupAction?: ReactNode;
}) {
  const ready = !!assessment?.ready && assessment.finalCharge != null;
  const dateOnly = assessment?.blockingIssues?.length === 1 && assessment.blockingIssues[0].category === 'date';
  const rows = ready ? assessmentChargeLines(assessment) : [];
  const creditApplied = assessment?.creditApplied ?? 0;
  const hasDeductions = (assessment?.verifiedPayments ?? 0) > 0 || creditApplied > 0;
  return <section aria-labelledby="estimated-charges-title" className="overflow-hidden rounded-xl border bg-card">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <h2 id="estimated-charges-title" className="text-sm font-semibold">Dropping charges</h2>
      <div className="flex flex-wrap items-center gap-3">
        {ready && <p className="text-xs text-muted-foreground">{PERIODS.find(period => period.key === assessment.period)?.label}</p>}
        {actions}
      </div>
    </header>
    {staff && assessment?.category && <dl className="border-b bg-muted/20 px-5 py-3 text-xs"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><dt className="text-muted-foreground">Fee policy</dt><dd className="font-medium">{assessment.category === 'voucher_esc' ? 'Voucher / ESC' : 'Paying'}<span className="ml-2 font-normal text-muted-foreground">· Automatic</span></dd></div></dl>}
    {loading ? <div role="status" className="space-y-3 p-5"><span className="sr-only">Loading charge estimate…</span><Skeleton className="h-4 w-40" /><Skeleton className="h-12 w-full" /></div>
      : failed ? <div className="flex flex-wrap items-center justify-between gap-3 p-5"><p role="alert" className="text-sm">The charge estimate couldn’t be loaded.</p><div className="flex flex-wrap gap-2">{setupAction}<Button variant="outline" size="sm" onClick={onRetry}><RefreshCwIcon aria-hidden="true" />Try again</Button></div></div>
      : !ready ? <div className="flex flex-wrap items-center justify-between gap-3 p-5"><p role="status" className="text-sm text-muted-foreground">{staff ? dateOnly ? 'Choose the effective date during approval to calculate the charges.' : 'Financial setup is required before approval.' : 'The school will confirm the charges when reviewing your request.'}</p>{setupAction}</div>
      : <>
        <div className="min-w-0 p-5">
          <div>
            {rows.length ? <>
              <div aria-hidden="true" className="flex justify-between gap-4 border-b pb-2 text-xs text-muted-foreground"><span>Fee</span><span>Charge</span></div>
              <dl className="divide-y text-sm">{rows.map((row, index) => <div key={index} className="flex items-start justify-between gap-4 py-3 last:pb-0">
                <dt className="min-w-0 space-y-1"><p className="break-words font-medium">{row.name}</p>{row.percent !== 100 && <p className="text-xs text-muted-foreground">{row.percent}% of {formatPeso(row.base)}</p>}</dt>
                <dd className="shrink-0 tabular-nums">{formatPeso(row.amount)}</dd>
              </div>)}</dl>
            </> : <p className="text-sm text-muted-foreground">An itemized breakdown isn’t available for this estimate.</p>}
          </div>
          <dl className="mt-3 space-y-3 border-t pt-4 text-sm">
            {hasDeductions && <div className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">Total charges</dt><dd className="shrink-0 tabular-nums">{formatPeso(assessment.finalCharge!)}</dd></div>}
            {assessment.verifiedPayments > 0 && <div className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">Verified payments</dt><dd className="shrink-0 tabular-nums">{formatPeso(-assessment.verifiedPayments)}</dd></div>}
            {creditApplied > 0 && <div className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">Applied credits</dt><dd className="shrink-0 tabular-nums">{formatPeso(-creditApplied)}</dd></div>}
            <div className={`flex items-baseline justify-between gap-4 font-semibold ${hasDeductions ? 'border-t pt-3' : ''}`}><dt>Balance</dt><dd className="shrink-0 tabular-nums">{formatPeso(assessment.balance)}</dd></div>
            {(assessment.credit ?? 0) > 0 && <div className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">Student credit</dt><dd className="shrink-0 tabular-nums">{formatPeso(assessment.credit!)}</dd></div>}
          </dl>
        </div>
        <p className="border-t px-5 py-3 text-xs leading-relaxed text-muted-foreground">As of <time dateTime={assessment.effectiveDate}>{new Date(`${assessment.effectiveDate}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</time>. Final charges depend on the approved dropping date.</p>
      </>}
  </section>;
}
import type { ReactNode } from 'react';
