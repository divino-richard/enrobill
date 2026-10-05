import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';
import type { DroppingRequest } from '@/features/dropping/api';
import { fetchAssessment, PERIODS, philippinesToday, type DroppingAssessment } from './api';

export function AssessmentSummary({ assessment, estimated = false, staff = false, current }: {
  assessment: DroppingAssessment;
  estimated?: boolean;
  staff?: boolean;
  current?: DroppingRequest['financialSummary'];
}) {
  if (assessment.legacy) return <p className="text-sm text-muted-foreground">This request was approved before the dropping-charge policy. Its original bill remains unchanged.</p>;
  if ((!assessment.ready && !assessment.finalized) || assessment.finalCharge === null) {
    return <div className="space-y-2 text-sm" role="status">
      <p className="font-medium">Estimate unavailable</p>
      {staff ? <ul className="list-disc space-y-1 pl-4 text-muted-foreground">{assessment.issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p className="text-muted-foreground">The school will confirm your dropping charge when it approves your request.</p>}
    </div>;
  }
  const credit = current?.creditIssued ?? assessment.credit ?? 0;
  const creditApplied = current?.creditApplied ?? assessment.creditApplied ?? 0;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold">{estimated ? 'Estimated dropping charge' : 'Dropping assessment'}</h2>
      <span className="text-xs text-muted-foreground">{PERIODS.find(p => p.key === assessment.period)?.label} · {assessment.category === 'voucher_esc' ? 'Voucher / ESC' : 'Paying'}</span>
    </div>
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4 text-muted-foreground"><dt>Original assessment</dt><dd className="tabular-nums">{formatPeso(assessment.originalTotal)}</dd></div>
      <div className="flex justify-between gap-4 font-semibold"><dt>{estimated ? 'Policy charge' : 'Final charge'}</dt><dd className="tabular-nums">{formatPeso(assessment.finalCharge)}</dd></div>
      <div className="flex justify-between gap-4"><dt>Verified payments</dt><dd className="tabular-nums">{formatPeso(current?.verifiedPayments ?? assessment.verifiedPayments)}</dd></div>
      {creditApplied > 0 && <div className="flex justify-between gap-4"><dt>Student credit used</dt><dd className="tabular-nums">{formatPeso(creditApplied)}</dd></div>}
      <div className="flex justify-between gap-4 border-t pt-2 font-semibold"><dt>{estimated ? 'Balance after dropping' : 'Current balance'}</dt><dd className="tabular-nums">{formatPeso(current?.balance ?? assessment.balance)}</dd></div>
      {credit > 0 && <div className="flex justify-between gap-4"><dt>{estimated ? 'Credit for a future enrollment' : 'Student credit issued'}</dt><dd className="tabular-nums">{formatPeso(credit)}</dd></div>}
      {current && credit > 0 && <div className="flex justify-between gap-4 text-muted-foreground"><dt>Available student credit</dt><dd className="tabular-nums">{formatPeso(current.availableCredit)}</dd></div>}
    </dl>
    {estimated && <p className="text-xs text-muted-foreground">Based on {assessment.effectiveDate}. The approved effective date determines your final charge.</p>}
  </div>;
}

export function RequestAssessment({ requestId, final, current, staff, billId, active }: {
  requestId: number;
  final?: DroppingAssessment | null;
  current?: DroppingRequest['financialSummary'];
  staff: boolean;
  billId: number | null;
  active: boolean;
}) {
  const date = philippinesToday();
  const query = useQuery({ queryKey: ['dropping-assessment', requestId, date], queryFn: () => fetchAssessment(requestId, date), enabled: !final && active });
  if (!final && !active) return null;
  return <section className="space-y-3 border-t pt-5" aria-label="Dropping charges">
    {final ? <AssessmentSummary assessment={final} current={current} staff={staff} /> : query.isPending ? <p className="text-sm text-muted-foreground" role="status">Calculating estimated charge…</p> : query.isError ? <div className="space-y-2"><p className="text-sm text-destructive" role="alert">{getErrorMessage(query.error)}</p><Button variant="outline" size="sm" onClick={() => query.refetch()}>Try again</Button></div> : query.data && <AssessmentSummary assessment={query.data} estimated staff={staff} />}
    {staff && query.data && !query.data.ready && billId && <Link className="text-sm text-primary underline underline-offset-4" to={`/admin/billing/${billId}`}>Review bill setup</Link>}
  </section>;
}
