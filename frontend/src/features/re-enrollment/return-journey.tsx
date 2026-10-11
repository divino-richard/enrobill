import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarClockIcon, CheckCircle2Icon, ChevronDownIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StudentReturnSummary } from './api';
import { returnDate, returnTitle } from './presentation';
import { formatPeso } from '@/lib/money';
import { getErrorMessage } from '@/lib/get-error-message';

function PaymentRequirement({ title, schoolYear, amount, billId, settled = false, children }: {
  title: string;
  schoolYear: string;
  amount: number | null;
  billId?: number | null;
  settled?: boolean;
  children?: ReactNode;
}) {
  return <section className="space-y-3 py-4">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">SY {schoolYear}</p>
        {settled && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden="true" />Requirement met</p>}
      </div>
      <div className="shrink-0 space-y-2 text-right">
        {amount != null && <p className="text-base font-semibold tabular-nums">{formatPeso(amount)}</p>}
        {billId != null && <Button asChild variant="outline" size="sm" className="min-h-10">
          <Link to={`/portal/bills/${billId}`} aria-label={`View ${title.toLowerCase()} bill for SY ${schoolYear}`}>
            {settled ? 'View statement' : 'View bill'}<ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>}
      </div>
    </div>
    {children}
  </section>;
}

export function ReturnJourney({ data, onStart, busy = false, error }: {
  data: StudentReturnSummary;
  onStart: () => void;
  busy?: boolean;
  error?: unknown;
}) {
  const pending = data.state === 'pending';
  const enrolled = data.state === 'enrolled';
  const blocked = data.state === 'blocked';
  const offer = data.offer;
  const source = data.source;
  const programName = data.enrollment?.programName ?? source?.programName;
  const yearLevel = data.enrollment?.yearLevel ?? source?.yearLevel;
  const schoolYear = offer?.schoolYear ?? data.enrollment?.schoolYear ?? source?.schoolYear;
  const paymentPreview = offer && offer.downpaymentValue > 0
    ? Math.min(offer.feeTotal, offer.downpaymentType === 'percentage' ? offer.feeTotal * offer.downpaymentValue / 100 : offer.downpaymentValue)
    : null;
  const newPayment = data.requirements?.newEnrollmentPayment ?? paymentPreview;

  return <div className="space-y-5">
    <section className="space-y-4">
      {(!pending && !data.canStart) && <header className="space-y-2">
        <h2 className="text-base font-semibold">{returnTitle(data)}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{enrolled
          ? `Your returning enrollment for SY ${data.enrollment?.schoolYear} is active. Your previous dropping record stays in your history.`
          : data.blockers[0] ?? 'This process is for students returning after an approved drop. Your current enrollment is available in My Program.'}</p>
        {blocked && data.blockers.slice(1).map(issue => <p key={issue} className="text-sm leading-relaxed text-muted-foreground">{issue}</p>)}
      </header>}

      {programName && <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-base font-semibold leading-snug">{programName}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {yearLevel && <span className="capitalize">{yearLevel.replaceAll('_', ' ')}</span>}
            {yearLevel && schoolYear && <span aria-hidden="true">·</span>}
            {schoolYear && <span>{!offer && !data.enrollment && 'Previous '}SY {schoolYear}</span>}
          </p>
        </div>
        {(pending || data.canStart) && <Badge variant="outline">{pending ? 'Pending' : 'Ready to start'}</Badge>}
      </div>}

      {data.returnDeadline && <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <CalendarClockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>{blocked ? 'Return deadline:' : 'Complete re-enrollment by'} <strong className="font-medium text-foreground">{returnDate(data.returnDeadline)}</strong> · Manila time</span>
      </p>}
      {enrolled && <div className="flex flex-wrap gap-3">
        <Button asChild><Link to="/portal/programs">View my program<ArrowRightIcon aria-hidden="true" /></Link></Button>
        {data.enrollment?.billId && <Button asChild variant="outline"><Link to={`/portal/bills/${data.enrollment.billId}`}>View new bill</Link></Button>}
      </div>}
    </section>

    {!enrolled && data.state !== 'not_applicable' && <section aria-labelledby="return-payment-heading" className="border-t pt-5">
      <header className="space-y-1.5">
        <h2 id="return-payment-heading" className="text-sm font-semibold">{pending ? 'Payment requirements' : data.canStart ? 'Payments when you return' : 'Your payments'}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{pending
          ? data.requirements?.canActivate
            ? 'Your payment requirements are met. Your enrollment is still pending.'
            : 'Pay each bill separately to activate enrollment. Only verified payments and applied credits count.'
          : blocked
            ? 'Voluntary payments are accepted. Payments do not resolve the eligibility issue shown above.'
            : 'No immediate payment or clearance is required. You can pay voluntarily, or settle when you return.'}</p>
      </header>
      <div className="mt-1 divide-y">
        {data.previousBills.map(bill => <PaymentRequirement
          key={bill.id}
          title="Previous dropping balance"
          schoolYear={bill.schoolYear}
          amount={bill.balance}
          billId={bill.id}
          settled={bill.balance === 0}
        >
          {bill.pendingPayment > 0 && <p className="text-xs text-muted-foreground">{formatPeso(bill.pendingPayment)} awaiting verification</p>}
        </PaymentRequirement>)}
        {data.previousBills.length === 0 && <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />Previous balances are settled.
        </p>}
        {(offer || data.enrollment) && <PaymentRequirement
          title="New enrollment payment"
          schoolYear={offer?.schoolYear ?? data.enrollment!.schoolYear}
          amount={newPayment}
          billId={data.enrollment?.billId}
          settled={data.requirements?.newEnrollmentPayment === 0}
        >
          {offer && <p className="text-xs leading-relaxed text-muted-foreground">
            {paymentPreview != null ? 'Estimated activation payment. ' : 'The first installment is required to activate enrollment. '}
            Total fees: {formatPeso(offer.feeTotal)}. Your new bill confirms the amount after applicable credits.
          </p>}
          {data.enrollment && !data.enrollment.billId && <p className="text-sm text-muted-foreground">The school needs to generate your new bill. Contact the school for assistance.</p>}
          {data.enrollment?.billId && newPayment == null && <p className="text-sm text-muted-foreground">The payment requirement will be confirmed on your new bill.</p>}
        </PaymentRequirement>}
      </div>
      {data.availableCredit > 0 && <p className="border-t py-4 text-xs leading-relaxed text-muted-foreground">
        Available student credit: <strong className="font-medium text-foreground">{formatPeso(data.availableCredit)}</strong>. Eligible credit is applied to your new bill automatically.
      </p>}
      {pending && data.blockers.length > 0 && <details className="group border-t">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Why is my enrollment pending?<ChevronDownIcon className="size-4 shrink-0 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="list-disc space-y-2 pb-3 pl-5 text-sm leading-relaxed text-muted-foreground">{data.blockers.map(issue => <li key={issue}>{issue}</li>)}</ul>
      </details>}
    </section>}

    {data.canStart && <form className="space-y-4 border-t pt-5" onSubmit={event => { event.preventDefault(); if (!busy) onStart(); }}>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>Starting creates your new bill without making a payment. Both payment requirements must be met before the deadline to activate enrollment.</p>
        <p>You’ll keep your account, student number, program and grade level. Previous vouchers are not automatically renewed. Contact the school first if your program, grade or voucher eligibility needs review.</p>
      </div>
      {!!error && <p role="alert" className="text-sm text-destructive">{getErrorMessage(error)}</p>}
      <Button type="submit" disabled={busy} className="min-h-11 w-full sm:w-auto">{busy ? 'Starting re-enrollment…' : 'Start re-enrollment'}<ArrowRightIcon aria-hidden="true" /></Button>
    </form>}

    <nav aria-label="Your records" className="flex flex-wrap gap-x-5 border-t pt-2 text-xs">
      <Link className="inline-flex min-h-11 items-center rounded-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring" to="/portal/bills">All bills & payments</Link>
      {source?.droppingRequestId && <Link className="inline-flex min-h-11 items-center rounded-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring" to={`/portal/dropping-requests/${source.droppingRequestId}`}>Dropping approval</Link>}
    </nav>
  </div>;
}
