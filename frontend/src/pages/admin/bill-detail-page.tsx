import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ChevronRightIcon, PrinterIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/features/auth/store';
import { useProgramLabel } from '@/features/programs/hooks';
import { useBill } from '@/features/bills/hooks';
import { billStatusMeta, isDroppingBill } from '@/features/bills/collection';
import { PAYMENT_STATUS_META, paymentMethodLabel, type Bill, type BillPayment } from '@/features/bills/types';
import { formatBillDate } from '@/features/bills/staff-billing';
import { printBillReceipt } from '@/features/bills/receipt';
import { DroppingBillStatement, DroppingBillHistory } from '@/features/bills/components/dropping-statement';
import { StaffBillSummary, StaffInstallmentPlan } from '@/features/bills/components/staff-bill-reference';
import { StaffRecordPayment } from '@/features/bills/components/staff-record-payment';
import { StaffPaymentReview } from '@/features/bills/components/staff-payment-review';
import { BillCollectionNotice } from '@/features/dropping-finance/collection-notice';
import { BillFinanceSummary, ClassificationDialog } from '@/features/dropping-finance/bill-finance';
import { formatPeso } from '@/lib/money';

function PaymentRow({ payment, readOnly, onReview }: {
  payment: BillPayment; readOnly: boolean; onReview: () => void;
}) {
  const pending = payment.status === 'pending';
  const needsReview = pending && !readOnly;

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-lg leading-6 font-semibold tracking-tight tabular-nums wrap-anywhere">
            <span className="sr-only">Payment amount: </span>{formatPeso(payment.amount)}
          </span>
          <span className="text-sm font-medium text-muted-foreground">{paymentMethodLabel(payment.method)}</span>
          <Badge variant="outline" className={PAYMENT_STATUS_META[payment.status].className}>
            {pending ? 'To verify' : PAYMENT_STATUS_META[payment.status].label}
          </Badge>
        </p>
        <p className="flex flex-col gap-x-3 gap-y-1 text-sm leading-relaxed text-muted-foreground sm:flex-row sm:flex-wrap sm:items-baseline">
          <time dateTime={payment.paidAt ?? undefined}>{formatBillDate(payment.paidAt)}</time>
          {payment.reference && (
            <span className="inline-flex min-w-0 max-w-full gap-3">
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="min-w-0 tabular-nums wrap-anywhere">Ref. {payment.reference}</span>
            </span>
          )}
          {(payment.submittedBy || payment.recordedBy) && (
            <span className="inline-flex min-w-0 max-w-full gap-3">
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="min-w-0 wrap-anywhere">{payment.submittedBy ? 'Submitted by' : 'Recorded by'} {payment.submittedBy || payment.recordedBy}</span>
            </span>
          )}
        </p>
      </div>
      <Button
        id={`review-payment-${payment.id}`}
        variant={needsReview ? 'default' : 'ghost'}
        size="sm"
        className={`min-h-11 self-start sm:min-h-9 sm:self-center ${needsReview ? '' : 'text-primary hover:text-primary'}`}
        onClick={onReview}
        aria-label={`${needsReview ? 'Review' : 'View'} ${formatPeso(payment.amount)} ${paymentMethodLabel(payment.method)} payment dated ${formatBillDate(payment.paidAt)}`}
      >
        {needsReview ? 'Review payment' : 'View details'}
        {!needsReview && <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />}
      </Button>
    </li>
  );
}

function BalanceSummary({ bill }: { bill: Bill }) {
  const status = billStatusMeta(bill);

  return (
    <section aria-label="Bill balance" className="overflow-hidden rounded-xl border bg-card">
      <div className="grid lg:grid-cols-2">
        <dl className="flex flex-col justify-center border-b bg-muted/30 p-5 lg:border-r lg:border-b-0">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Balance</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                {formatPeso(bill.balance)}
              </span>
              <Badge variant="outline" className={status.className}>{status.label}</Badge>
            </dd>
          </div>
        </dl>
        <dl className="divide-y px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
            <dt className="text-sm font-medium">Due now</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatPeso(bill.amountDue)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
            <dt className="text-sm text-muted-foreground">Verified payments</dt>
            <dd className="text-lg font-medium tabular-nums">{formatPeso(bill.amountPaid)}</dd>
          </div>
        </dl>
      </div>
      {(bill.creditApplied ?? 0) > 0 && (
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          Student credit applied: <span className="font-medium text-foreground tabular-nums">{formatPeso(bill.creditApplied ?? 0)}</span>
        </p>
      )}
    </section>
  );
}

function BillDetailPage() {
  const { id } = useParams();
  const billId = Number(id);
  const { data: bill, isLoading, isError, refetch } = useBill(billId);
  const role = useAuthStore(state => state.user?.role);
  const readOnly = role !== 'cashier';
  const programLabel = useProgramLabel();
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  if (isLoading) return <div role="status" aria-label="Loading bill" className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /><span className="sr-only">Loading bill…</span></div>;
  if (isError || !bill) return <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center"><p role="alert" className="text-muted-foreground">We couldn't load this bill. Try again or return to billing.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button><Link to="/admin/billing" className="text-sm underline underline-offset-4">Back to billing</Link></div>;

  const dropping = isDroppingBill(bill);
  const payments = bill.payments ?? [];
  const pending = payments.filter(payment => payment.status === 'pending');
  const history = payments.filter(payment => payment.status !== 'pending');
  const studentName = bill.student?.name ?? `Bill #${bill.id}`;
  const program = bill.student ? programLabel(bill.student.track, bill.student.yearLevel) : null;

  return <div className="w-full space-y-5">
    <header>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link to="/admin/billing"><ArrowLeftIcon aria-hidden="true" />Back to billing</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><PageHeader title={studentName} description={[bill.student?.studentNumber, program, bill.schoolYear ? `SY ${bill.schoolYear}` : null].filter(Boolean).join(' · ')} /></div>
        <div className="space-y-2 sm:text-right">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {role === 'admin' && !dropping && <ClassificationDialog bill={bill} />}
            <Button variant="default" disabled={bill.amountPaid <= 0} onClick={() => printBillReceipt(bill, { name: studentName, studentNumber: bill.student?.studentNumber, program })}><PrinterIcon aria-hidden="true" />Print receipt</Button>
          </div>
        </div>
      </div>
    </header>

    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{notice}</div>

    <BalanceSummary bill={bill} />
    <BillCollectionNotice bill={bill} />

    <Card className="gap-0 pb-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b">
        <h2 id="bill-payments-heading" tabIndex={-1} className="text-base font-semibold">Payments</h2>
        {readOnly ? (
          <p className="max-w-prose text-sm text-muted-foreground">Only cashiers can record, verify, or reject payments.</p>
        ) : (
          <StaffRecordPayment key={bill.id} bill={bill} onSuccess={setNotice} />
        )}
      </CardHeader>
      <CardContent className="p-0">
      {pending.length > 0 && <ul aria-label="Payments awaiting verification" className="divide-y">{pending.map(payment => <PaymentRow key={payment.id} payment={payment} readOnly={readOnly} onReview={() => setReviewId(payment.id)} />)}</ul>}
      {history.length > 0 && <ul aria-label="Payment history" className={pending.length > 0 ? 'divide-y border-t' : 'divide-y'}>{history.map(payment => <PaymentRow key={payment.id} payment={payment} readOnly={readOnly} onReview={() => setReviewId(payment.id)} />)}</ul>}
      {payments.length === 0 && <p className="p-4 text-sm text-muted-foreground">{bill.balance <= 0 ? 'No payment records. This bill has no remaining balance.' : readOnly ? 'No payments recorded yet.' : 'No payments recorded yet. Use Record payment when the school receives a payment.'}</p>}
      </CardContent>
    </Card>

    {!dropping && <BillFinanceSummary bill={bill} staff />}
    {dropping ? <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card><CardHeader><h2 className="text-base font-semibold">Charges and payments</h2><p className="text-sm text-muted-foreground">Approved charges less verified payments and applied credits.</p></CardHeader><CardContent><DroppingBillStatement bill={bill} /></CardContent></Card>
      <section aria-labelledby="financial-history-heading" className="rounded-xl border bg-card p-4"><h2 id="financial-history-heading" className="mb-3 text-base font-semibold">Financial history</h2><details><summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">View original fees and schedules</summary><div className="mt-4"><DroppingBillHistory bill={bill} staff /></div></details></section>
    </div> : <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"><StaffBillSummary bill={bill} /><StaffInstallmentPlan key={bill.id} bill={bill} /></div>}

    {reviewId !== null && <StaffPaymentReview key={`${bill.id}-${reviewId}`} bill={bill} paymentId={reviewId} readOnly={readOnly} onClose={() => setReviewId(null)} onSuccess={setNotice} />}
  </div>;
}

export default BillDetailPage;
