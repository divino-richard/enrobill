import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { returnDate, STUDENT_RETURN_PATH } from '@/features/re-enrollment/presentation';
import { formatPeso } from '@/lib/money';
import { approvedChargeLines, droppingAssessmentContext } from '../dropping-statement';
import type { Bill } from '../types';

export function StudentDroppingSummary({ bill }: { bill: Bill }) {
  const assessment = bill.droppingAssessment;
  const rows = approvedChargeLines(bill);
  const requirements = bill.returnRequirements;
  const eligible = requirements?.eligible !== false;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <section aria-labelledby="dropping-fees-heading">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-4 sm:px-5">
          <h2 id="dropping-fees-heading" className="text-sm font-semibold">{assessment ? 'Approved fee breakdown' : 'Assessment details'}</h2>
          <p className="text-xs text-muted-foreground">{droppingAssessmentContext(bill)}</p>
        </header>
        {rows.length > 0 ? (
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Fees included in the approved dropping assessment</caption>
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-4 py-2 text-left font-medium sm:px-5">Fee</th>
                <th scope="col" className="w-32 px-4 py-2 text-right font-medium sm:w-40 sm:px-5">Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row" className="px-4 py-3 text-left font-normal sm:px-5">
                    <span className="block break-words font-medium">{row.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{row.percent}% of {formatPeso(row.base)}</span>
                  </th>
                  <td className="px-4 py-3 text-right align-top font-medium tabular-nums sm:px-5">{formatPeso(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="max-w-prose px-4 py-5 text-sm leading-relaxed text-muted-foreground sm:px-5">
            {assessment ? 'An itemized breakdown was not saved with this approval. Contact the school for details.' : 'No approved charge breakdown is on file. Contact the school to review this balance.'}
          </p>
        )}
      </section>

      <section aria-label="Re-enrollment" className="space-y-3 border-t bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="space-y-1 text-sm">
            <h2 className="font-medium">{!eligible ? 'Re-enrollment needs attention' : bill.balance > 0 ? 'Before you return' : 'Dropping balance settled'}</h2>
            <p className="max-w-prose leading-relaxed text-muted-foreground">
              {!eligible ? 'Payment is optional and will not resolve the eligibility issue below.' : bill.balance > 0 ? 'Settle this balance and wait for verification before starting re-enrollment.' : 'Check My Program for your next enrollment step.'}
            </p>
            {requirements?.returnDeadline && <p className="text-xs text-muted-foreground">{eligible ? 'Complete re-enrollment by' : 'Return deadline:'} <span className="font-medium text-foreground">{returnDate(requirements.returnDeadline)}</span></p>}
          </div>
          <Button asChild variant="ghost" size="sm" className="w-fit shrink-0 text-primary">
            <Link to={STUDENT_RETURN_PATH}>Re-enrollment<ArrowRightIcon /></Link>
          </Button>
        </div>
        {!eligible && !!requirements?.blockers.length && <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">{requirements.blockers.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {(bill.creditIssued ?? 0) > 0 && <p className="text-xs text-muted-foreground">{formatPeso(bill.creditIssued!)} in excess payments was issued as student credit. See History for allocations.</p>}
      </section>
    </div>
  );
}
