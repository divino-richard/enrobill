import { PayDialog } from "./pay-dialog";
import { appliedCreditLines } from '../credits';
import { billStatusMeta, collectionLabel, isDroppingBill } from '@/features/bills/collection';
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { formatDate } from "@/features/applications/utils";
import { printBillReceipt } from "@/features/bills/receipt";
import { useAuthStore } from "@/features/auth/store";
import {
  type Bill,
} from "@/features/bills/types";
import {
  billReceiptParty,
  isOverdue,
  nextOutstandingInstallment,
  termTitle,
} from "@/features/bills/utils";

function billReference(id: number) {
  return `BILL-${String(id).padStart(5, "0")}`;
}

export function BillActionPanel({ bill }: { bill: Bill }) {
  const userName = useAuthStore((state) => state.user?.name) ?? "Student";
  const pendingTotal = (bill.payments ?? [])
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const nextDue = nextOutstandingInstallment(bill.installments ?? []);

  const dropping = isDroppingBill(bill);
  const status = billStatusMeta(bill);
  const hasPending = pendingTotal > 0;
  const dueOverdue = isOverdue(nextDue?.dueDate ?? null);
  const settled = bill.balance <= 0;
  const primaryLabel = bill.amountDue > 0 ? "Amount due now" : "Remaining balance";
  const primaryValue = bill.amountDue > 0 ? bill.amountDue : bill.balance;
  const dueLine = bill.amountDue > 0 && nextDue?.dueDate
      ? `${dueOverdue ? "Overdue since" : "Due"} ${formatDate(nextDue.dueDate)}`
      : nextDue
        ? `Next installment ${formatPeso(nextDue.balance)}${
            nextDue.dueDate ? ` on ${formatDate(nextDue.dueDate)}` : ""
          }`
        : null;

  if (dropping) {
    return <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{bill.droppingAssessment ? 'Dropping assessment' : 'Previous enrollment bill'}</h1>
            <Badge variant="outline" className={status.className}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{termTitle(bill)} · {billReference(bill.id)}</p>
        </div>
        {bill.amountPaid > 0 && <Button variant="outline" size="sm" onClick={() => printBillReceipt(bill, billReceiptParty(bill, userName))}><DownloadIcon />Receipt</Button>}
      </div>
      <section aria-label="Balance and payment" className="overflow-hidden rounded-xl border bg-card">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,1fr)_auto] lg:items-center lg:gap-8">
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium">Remaining balance</h2>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatPeso(bill.balance)}</p>
            <p className="text-xs text-muted-foreground">{bill.balance <= 0 ? 'Fully settled' : collectionLabel(bill)}</p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{bill.droppingAssessment ? 'Approved charges' : 'Recorded assessment'}</dt><dd className="shrink-0 font-medium tabular-nums">{formatPeso(bill.netTotal)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Verified payments</dt><dd className="shrink-0 tabular-nums">{formatPeso(-bill.amountPaid)}</dd></div>
            {appliedCreditLines(bill, 'Applied credit').map(credit => <div key={credit.kind} className="flex justify-between gap-4"><dt className="text-muted-foreground">{credit.label}</dt><dd className="shrink-0 tabular-nums">{formatPeso(-credit.amount)}</dd></div>)}
          </dl>
          {bill.balance > 0 && <PayDialog bill={bill} disabled={hasPending} triggerClassName="min-h-10 w-full lg:w-auto" triggerLabel={hasPending ? 'Awaiting verification' : bill.collectionState === 'required_for_reenrollment' ? 'Make a payment' : 'Pay now'} />}
        </div>
        {hasPending && <p role="status" className="flex items-start gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:px-5"><ClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{formatPeso(pendingTotal)} awaiting verification. Your balance updates after approval.</span></p>}
      </section>
    </header>;
  }

  return <header className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight">Enrollment bill</h1>
          <Badge variant="outline" className={status.className}>{status.label}</Badge>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{termTitle(bill)}</span><span aria-hidden="true">·</span><span>{billReference(bill.id)}</span>
          {bill.createdAt && <><span aria-hidden="true">·</span><span>Issued {formatDate(bill.createdAt)}</span></>}
        </p>
      </div>
      {bill.amountPaid > 0 && <Button variant="outline" size="sm" onClick={() => printBillReceipt(bill, billReceiptParty(bill, userName))}><DownloadIcon aria-hidden="true" />Receipt</Button>}
    </div>

    <section aria-label="Balance and payment" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        {settled ? <div className="flex items-center gap-3">
          <CheckCircle2Icon className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <div className="space-y-1"><h2 className="text-base font-semibold">Bill settled</h2><p className="text-sm text-muted-foreground">No remaining balance.</p></div>
        </div> : <>
          <div className="min-w-0 space-y-2">
            <dl className="space-y-1">
              <dt className="text-sm font-medium">{primaryLabel}</dt>
              <dd className={cn('break-words text-3xl font-semibold tracking-tight tabular-nums', bill.amountDue > 0 && dueOverdue && 'text-red-600 dark:text-red-400')}>{formatPeso(primaryValue)}</dd>
            </dl>
            {(dueLine || bill.balance > primaryValue) && <div className="flex flex-col gap-1 text-sm text-muted-foreground md:flex-row md:flex-wrap md:gap-x-5 md:gap-y-1">
              {dueLine && <p className={cn('flex items-start gap-1.5', bill.amountDue > 0 && dueOverdue && 'font-medium text-red-600 dark:text-red-400')}>
                {bill.amountDue > 0 && dueOverdue ? <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CalendarClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                <span>{dueLine}</span>
              </p>}
              {bill.balance > primaryValue && <p>Remaining balance <span className="font-medium text-foreground tabular-nums">{formatPeso(bill.balance)}</span></p>}
            </div>}
          </div>
          <div className="shrink-0 sm:min-w-32">
            <PayDialog bill={bill} disabled={hasPending} triggerClassName="min-h-10 w-full" triggerLabel={hasPending ? 'Awaiting verification' : bill.amountDue > 0 ? 'Pay now' : 'Pay in advance'} />
          </div>
        </>}
      </div>
      {hasPending && <p role="status" className="flex items-start gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:px-5"><ClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{formatPeso(pendingTotal)} awaiting verification. Your balance updates after approval.</span></p>}
    </section>
  </header>;
}
