import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, Clock3Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso } from "@/lib/money";
import { billStatusMeta, collectionLabel, isDroppingBill } from "../collection";
import { approvedChargeLines, droppingAssessmentContext } from "../dropping-statement";
import { useStudentBill } from "../hooks";
import type { Bill } from "../types";

export function BillCard({ studentId }: { studentId: number }) {
  const query = useStudentBill(studentId);
  const missing = isAxiosError(query.error) && query.error.response?.status === 404;

  if (query.isLoading) {
    return (
      <Card role="status" aria-label="Loading billing" className="gap-5 p-5">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (query.isError && !missing) {
    return (
      <Card className="items-start gap-3 p-5">
        <h2 className="text-base font-semibold">Billing unavailable</h2>
        <p role="alert" className="text-sm text-muted-foreground">We couldn’t load this student’s bill. Please try again.</p>
        <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}>
          {query.isFetching ? "Retrying…" : "Try again"}
        </Button>
      </Card>
    );
  }

  if (!query.data || missing) {
    return (
      <Card className="items-start gap-3 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Not billed yet</h2>
          <p className="text-sm text-muted-foreground">No bill is available for the active school year.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/admin/enrollments">View enrollments<ArrowRightIcon aria-hidden="true" /></Link></Button>
      </Card>
    );
  }

  return <StudentBillOverview key={query.data.id} bill={query.data} />;
}

function StudentBillOverview({ bill }: { bill: Bill }) {
  const dropping = isDroppingBill(bill);
  const status = billStatusMeta(bill);
  const pendingCount = bill.pendingPaymentCount ?? bill.payments?.filter(payment => payment.status === "pending").length ?? 0;

  return (
    <Card className="gap-0 py-0">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{dropping ? "Dropping bill" : "Enrollment bill"}</h2>
          <p className="text-xs text-muted-foreground">{bill.schoolYear && `SY ${bill.schoolYear} · `}Bill #{bill.id}</p>
        </div>
        <Button asChild size="sm"><Link to={`/admin/billing/${bill.id}`}>View bill<ArrowRightIcon aria-hidden="true" /></Link></Button>
      </header>

      <div className="grid md:grid-cols-2">
        <section aria-label="Balance" className="min-w-0 space-y-4 bg-muted/20 p-5 sm:p-6">
          <dl className="space-y-2">
            <dt className="text-sm text-muted-foreground">Remaining balance</dt>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums break-all">{formatPeso(bill.balance)}</span>
              <Badge variant="outline" className={status.className}>{status.label}</Badge>
            </dd>
          </dl>
          <p className="text-sm text-muted-foreground">
            {bill.balance <= 0 ? "No remaining balance."
              : dropping ? collectionLabel(bill)
                : bill.amountDue > 0 ? <>Due now <span className="ml-1 font-semibold text-foreground tabular-nums">{formatPeso(bill.amountDue)}</span></>
                  : "No payment due right now."}
          </p>
        </section>

        <section aria-label="Bill summary" className="min-w-0 border-t p-5 sm:p-6 md:border-t-0 md:border-l">
          <dl className="space-y-3 text-sm">
            {!dropping && bill.discountTotal > 0 && <>
              <AmountRow label="Fees" amount={bill.total} />
              <AmountRow label="Vouchers and incentives" amount={-bill.discountTotal} />
            </>}
            <AmountRow label={dropping ? bill.droppingAssessment ? "Approved dropping charge" : "Recorded assessment" : "Bill total"} amount={bill.netTotal} strong />
            <AmountRow label="Verified payments" amount={bill.amountPaid > 0 ? -bill.amountPaid : 0} />
            {(bill.creditApplied ?? 0) > 0 && <AmountRow label="Student credit applied" amount={-bill.creditApplied!} />}
          </dl>
          {(bill.creditIssued ?? 0) > 0 && <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Student credit issued <span className="ml-1 font-medium text-foreground tabular-nums">{formatPeso(bill.creditIssued!)}</span></p>}
        </section>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 border-t px-5 py-3 text-sm">
          <Clock3Icon aria-hidden="true" className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <p>{pendingCount} {pendingCount === 1 ? "payment awaiting" : "payments awaiting"} verification</p>
        </div>
      )}

      <BillChargeBreakdown bill={bill} dropping={dropping} />
    </Card>
  );
}

function AmountRow({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={`shrink-0 tabular-nums ${strong ? "font-semibold" : "font-medium"}`}>{formatPeso(amount)}</dd>
    </div>
  );
}

function BillChargeBreakdown({ bill, dropping }: { bill: Bill; dropping: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const titleId = useId();
  const rows = dropping
    ? approvedChargeLines(bill).map(row => ({ ...row, detail: `${row.percent}% of ${formatPeso(row.base)}` }))
    : bill.items.map(item => ({ name: item.name, amount: item.amount, detail: null }));
  const visible = showAll ? rows : rows.slice(0, 4);

  return (
    <section aria-labelledby={titleId} className="border-t px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={titleId} className="text-sm font-semibold">{dropping ? bill.droppingAssessment ? "Approved fee breakdown" : "Assessment details" : "Fee breakdown"}</h3>
        <p className="text-xs text-muted-foreground">{dropping ? droppingAssessmentContext(bill) : `${rows.length} ${rows.length === 1 ? "item" : "items"}`}</p>
      </div>
      {rows.length > 0 ? (
        <dl id={listId} className="mt-2 divide-y text-sm">
          {visible.map((row, index) => (
            <div key={index} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="min-w-0 break-words">
                <span className="block">{row.name}</span>
                {row.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span>}
              </dt>
              <dd className="shrink-0 font-medium tabular-nums">{formatPeso(row.amount)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="pt-3 text-sm text-muted-foreground">{dropping ? "No itemized dropping assessment is on file." : "No fee items recorded."}</p>
      )}
      {rows.length > 4 && (
        <Button type="button" variant="ghost" size="sm" className="-ml-2 text-primary hover:text-primary" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll(value => !value)}>
          {showAll ? "Show fewer fees" : `View all ${rows.length} fees`}
          {showAll ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
        </Button>
      )}
    </section>
  );
}
