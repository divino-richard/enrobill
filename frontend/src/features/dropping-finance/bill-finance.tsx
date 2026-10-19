import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPeso } from '@/lib/money';
import type { Bill } from '@/features/bills/types';
import { appliedCreditLines } from '@/features/bills/credits';

export function BillFinanceSummary({ bill, staff = false, historyOnly = false }: { bill: Bill; staff?: boolean; historyOnly?: boolean }) {
  const assessment = historyOnly ? null : bill.droppingAssessment;
  const hasCredit = (bill.creditHistory?.length ?? 0) > 0 || (bill.availableCredit ?? 0) > 0 || (bill.creditApplied ?? 0) > 0;
  if (historyOnly ? !hasCredit : !assessment && !hasCredit && !(bill.previousBalance ?? 0) && !bill.paymentArrangement) return null;
  return <Card><CardHeader><CardTitle className="text-base">{assessment ? 'Dropping assessment' : 'Student account'}</CardTitle></CardHeader><CardContent className="space-y-4">
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {assessment && <><div><dt className="text-muted-foreground">Original assessment</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(bill.assessmentOriginalTotal ?? assessment.originalTotal)}</dd></div><div><dt className="text-muted-foreground">Final dropping charge</dt><dd className="mt-1 font-semibold tabular-nums">{formatPeso(bill.netTotal)}</dd></div></>}
      {!assessment && !historyOnly && <><div><dt className="text-muted-foreground">Previous balance</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(bill.previousBalance ?? 0)}</dd></div><div><dt className="text-muted-foreground">This school-year balance</dt><dd className="mt-1 font-semibold tabular-nums">{formatPeso(bill.balance)}</dd></div></>}
      {appliedCreditLines(bill, 'Student credit used here').map(credit => <div key={credit.kind}><dt className="text-muted-foreground">{credit.label}</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(credit.amount)}</dd></div>)}<div><dt className="text-muted-foreground">Available student credit</dt><dd className="mt-1 font-medium tabular-nums">{formatPeso(bill.availableCredit ?? 0)}</dd></div>
    </dl>
    {assessment && <p className="text-xs text-muted-foreground">Effective {assessment.effectiveDate} · Policy version {assessment.policyVersion}. Original vouchers and incentives are kept in history; they do not reduce this final charge.</p>}
    {!historyOnly && (bill.previousBalance ?? 0) > 0 && <p className="text-sm text-muted-foreground">Settle previous dropping balances before starting re-enrollment. Pending payments and payment arrangements do not meet this requirement.</p>}
    {hasCredit && <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Student credit history</h3><ul className="divide-y">{bill.creditHistory?.map(credit => <li key={credit.id} className="space-y-2 py-3 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><Link className="text-primary underline underline-offset-4" to={`${staff ? '/admin/billing' : '/portal/bills'}/${credit.sourceBillId}`}>From bill #{credit.sourceBillId}</Link><span className="font-medium tabular-nums">{formatPeso(credit.amount)} issued</span></div><p className="text-sm font-medium">{credit.label ?? 'Excess payment credit'}</p><p className="text-xs text-muted-foreground">{formatPeso(credit.allocated)} used · {formatPeso(credit.remaining)} available</p>{credit.allocations.length > 0 && <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{credit.allocations.map(allocation => <li key={allocation.id}><Link className="text-primary underline underline-offset-4" to={`${staff ? '/admin/billing' : '/portal/bills'}/${allocation.billId}`}>Bill #{allocation.billId}: {formatPeso(allocation.amount - allocation.releasedAmount)} used</Link>{allocation.releasedAmount > 0 && <span className="text-muted-foreground"> · {formatPeso(allocation.releasedAmount)} released</span>}</li>)}</ul>}</li>)}</ul><p className="text-xs text-muted-foreground">Excess payment credits and returning student credits are tracked separately and applied to eligible later school-year bills.</p></section>}

  </CardContent></Card>;
}
