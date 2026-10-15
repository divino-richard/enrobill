import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DroppingBillStatement } from '@/features/bills/components/dropping-statement';
import { useStudentReturn, type StudentReturnSummary } from '@/features/re-enrollment/api';
import { returnDate, returnNeedsEligibilityReview, previousSettlementRequired, STUDENT_RETURN_PATH } from '@/features/re-enrollment/presentation';
import { formatPeso } from '@/lib/money';
import type { DroppingRequest } from './api';

export function ApprovedRequestCharges({ request, children, staff = false, actions }: { request: DroppingRequest; children?: ReactNode; staff?: boolean; actions?: ReactNode }) {
  const assessment = request.droppingAssessment;
  const current = request.financialSummary;
  const hasAssessment = assessment && !assessment.legacy && assessment.finalCharge != null;
  return <section aria-labelledby="approved-charges-title" className="overflow-hidden rounded-xl border bg-card">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
      <h2 id="approved-charges-title" className={staff ? 'text-sm font-semibold' : 'text-base font-semibold'}>{staff ? 'Dropping charges' : 'Charges and payments'}</h2>
      {actions}
    </header>
    {hasAssessment ?
      <DroppingBillStatement columns={!staff} showApprovalDetails={staff} summaryFooter={<>{children}{staff && current && current.creditIssued > 0 && <p className="text-xs text-muted-foreground">Available student credit: <span className="tabular-nums">{formatPeso(current.availableCredit)}</span></p>}</>} bill={{
        droppingAssessment: assessment,
        netTotal: assessment.finalCharge!,
        amountPaid: current?.verifiedPayments ?? assessment.verifiedPayments,
        balance: current?.balance ?? request.balance,
        creditApplied: current?.creditApplied ?? assessment.creditApplied ?? 0,
        creditIssued: current?.creditIssued ?? assessment.credit ?? 0,
      }} />
    : <div className="space-y-5 p-5 text-sm sm:p-6">
      <p className="max-w-prose leading-relaxed text-muted-foreground">An itemized dropping assessment was not saved with this approval. Your existing bill is retained; contact the school to confirm the charge basis.</p>
      <dl><div className="flex justify-between gap-4 border-t pt-4"><dt>Recorded remaining balance</dt><dd className="font-semibold tabular-nums">{formatPeso(current?.balance ?? request.balance)}</dd></div></dl>
      {children}
    </div>}
  </section>;
}

export function DroppingReturnGuidance({ request, data }: { request: DroppingRequest; data: StudentReturnSummary }) {
  const sameDrop = data.source?.droppingRequestId === request.id;
  const completed = data.state === 'enrolled';
  const blocked = sameDrop && returnNeedsEligibilityReview(data);
  const settling = sameDrop && !blocked && ['pending', 'settlement_required'].includes(data.state) && previousSettlementRequired(data);
  const pendingBill = settling ? data.previousBills.find(bill => bill.balance > 0 && bill.pendingPayment > 0) : undefined;
  const unpaidBill = settling ? data.previousBills.find(bill => bill.balance > 0) : undefined;
  let title = 'Returning to school';
  let description = 'No payment or clearance is required now. Early payments are voluntary; settle the remaining dropping balance before starting re-enrollment.';
  let action = 'View return options';
  let href = STUDENT_RETURN_PATH;
  let primary = false;
  if (completed) {
    title = 'You have returned to school';
    description = 'This approval remains part of your enrollment history. View your current enrollment in My Program.';
    action = 'My Program'; href = '/portal/programs';
  } else if (!sameDrop && data.source) {
    title = 'Previous dropping record';
    description = 'Return options for your latest enrollment are available in My Program.';
  } else if (blocked) {
    title = 'Re-enrollment needs attention';
    description = 'Review the eligibility issue with the school. Making a payment does not restore eligibility.';
    action = 'Review eligibility';
  } else if (settling) {
    title = pendingBill ? 'Payment verification pending' : 'Settle your dropping balance to return';
    description = pendingBill
      ? 'Your submitted payment has not reduced the balance yet. Wait for verification before making another payment; any remaining balance must still be settled.'
      : data.state === 'pending'
        ? 'Settle your previous dropping balance before re-enrollment can proceed. Only verified payments and applied credits count.'
        : 'To start re-enrollment, settle your previous dropping balance first. Only verified payments and applied credits count.';
    action = pendingBill ? 'View payment status' : 'View bill & payment options';
    href = `/portal/bills/${pendingBill?.id ?? unpaidBill?.id ?? request.billId}`;
    primary = true;
    if (!pendingBill && !unpaidBill && !request.billId) { action = 'View return requirements'; href = STUDENT_RETURN_PATH; }
  } else if (sameDrop && data.state === 'ready') {
    title = 'Ready to re-enroll'; description = `Your previous dropping balance is settled. Admissions are open for ${data.offer ? `SY ${data.offer.schoolYear}` : 'the next school year'}.`;
    action = 'Review re-enrollment'; primary = true;
  } else if (sameDrop && data.state === 'pending') {
    title = data.enrollment?.billId ? 'Complete your new enrollment' : 'Waiting for your new bill';
    description = data.enrollment?.billId
      ? 'Your previous dropping balance is settled. Meet the new school year’s payment requirement to activate your enrollment.'
      : 'Your previous dropping balance is settled. The cashier will prepare your new school-year bill.';
    if (data.enrollment?.billId) { action = 'View new bill'; href = `/portal/bills/${data.enrollment.billId}`; primary = true; }
  } else if (sameDrop && data.state === 'unavailable') {
    title = 'Re-enrollment is not yet available';
  }
  return <section aria-labelledby="return-options-title" className="border-t pt-5">
    <div className="space-y-5">
      <div className="min-w-0 space-y-2">
        <h3 id="return-options-title" className="text-sm font-semibold">{title}</h3>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
        {sameDrop && !completed && data.returnDeadline && <p className="text-xs text-muted-foreground">{blocked ? 'Return deadline:' : 'Complete re-enrollment by'} <span className="font-medium text-foreground">{returnDate(data.returnDeadline)}</span></p>}
        {blocked && data.blockers[0] && <p className="max-w-prose text-sm leading-relaxed">{data.blockers[0]}</p>}
      </div>
      <div className="w-full">
        <Button asChild variant={primary ? 'default' : 'outline'} className="h-auto min-h-11 w-full whitespace-normal py-2.5 text-center"><Link to={href}>{action}<ArrowRightIcon aria-hidden="true" /></Link></Button>
      </div>
    </div>
  </section>;
}

export function ApprovedRequestReturn({ request }: { request: DroppingRequest }) {
  const query = useStudentReturn();
  if (query.isPending) return <div className="border-t pt-5"><Skeleton role="status" aria-label="Loading return options" className="h-20" /></div>;
  if (query.isError) return <section aria-label="Return options" className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className="text-sm" role="alert">Return options couldn’t be loaded. Your approved request is still available.</p><Button variant="outline" className="min-h-11" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button></section>;
  return query.data ? <DroppingReturnGuidance request={request} data={query.data} /> : null;
}
