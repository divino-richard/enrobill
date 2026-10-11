import { billStatusMeta, collectionLabel, isDroppingBill } from '@/features/bills/collection';
import { BillCollectionNotice, DroppingSchedule } from '@/features/dropping-finance/collection-notice';
import { BillFinanceSummary, ClassificationDialog } from '@/features/dropping-finance/bill-finance';
import { DashboardMetricStrip } from "@/components/dashboard/dashboard-primitives";
import { PageHeader } from "@/components/page-header";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel } from "@/components/form/field-label";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAuthStore } from "@/features/auth/store";
import { useProgramLabel } from "@/features/programs/hooks";
import {
  useBill,
  useRecordPayment,
  useRejectPayment,
  useVerifyPayment,
  useVoidBill,
  useVoidPayment,
} from "@/features/bills/hooks";
import {
  BILL_STATUS_META,
  INSTALLMENT_STATUS_META,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_META,
  paymentMethodLabel,
  type Bill,
  type PaymentMethod,
} from "@/features/bills/types";
import { printBillReceipt } from "@/features/bills/receipt";
import { PaymentProofDialog } from "@/features/bills/components/payment-proof-dialog";

const todayIso = () => new Date().toISOString().slice(0, 10);

function SummaryRow({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 hover:bg-muted cursor-pointer",
        emphasize ? "text-base" : "text-sm",
      )}
    >
      <span
        className={cn(
          emphasize ? "font-semibold" : "text-muted-foreground",
          muted && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasize ? "font-semibold" : "font-medium",
          muted && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RecordPaymentDialog({ bill }: { bill: Bill }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [note, setNote] = useState("");
  const record = useRecordPayment(bill.id);

  function seed() {
    setAmount(bill.balance > 0 ? String(bill.balance) : "");
    setMethod("cash");
    setReference("");
    setPaidAt(todayIso());
    setNote("");
    record.reset();
  }

  async function handleSave() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    try {
      await record.mutateAsync({
        amount: numericAmount,
        method,
        reference: reference.trim() || null,
        paidAt,
        note: note.trim() || null,
      });
      setOpen(false);
    } catch {
      // Surfaced via record.isError.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) seed();
        setOpen(next);
      }}
    >
      <Button size="sm" onClick={() => setOpen(true)} disabled={bill.balance <= 0}>
        <PlusIcon />
        Record payment
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Outstanding balance: {formatPeso(bill.balance)}. {isDroppingBill(bill) && `${collectionLabel(bill)}. Partial payments are accepted.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="amount" required>
                Amount
              </FieldLabel>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="method" required>
                Method
              </FieldLabel>
              <Select
                value={method}
                onValueChange={(next) => setMethod(next as PaymentMethod)}
              >
                <SelectTrigger id="method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="paidAt" required>
                Date paid
              </FieldLabel>
              <Input
                id="paidAt"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="reference">Reference / OR no.</FieldLabel>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="note">Note</FieldLabel>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {record.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(record.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={record.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!amount || Number(amount) <= 0 || record.isPending}
          >
            {record.isPending ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const billId = Number(id);
  const { data: bill, isLoading, isError, refetch } = useBill(billId);
  const voidPayment = useVoidPayment(billId);
  const verifyPayment = useVerifyPayment(billId);
  const rejectPayment = useRejectPayment(billId);
  const voidBill = useVoidBill();
  const programLabel = useProgramLabel();
  const role = useAuthStore((state) => state.user?.role);
  const isPaymentReadOnly = role === "admin";
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const termLabel = useMemo(() => {
    if (!bill?.schoolYear) return "—";
    return `SY ${bill.schoolYear}`;
  }, [bill]);

  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (isError || !bill) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <p className="text-muted-foreground text-sm">
          We couldn't load this bill.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const adjustments = bill.adjustments ?? [];
  const dropping = isDroppingBill(bill);
  const installments = bill.installments ?? [];
  const payments = bill.payments ?? [];
  // A bill with no verified/pending payments can be voided (returns the student
  // to the pending queue so the cashier can re-generate it).
  // const canVoid = payments.every((payment) => payment.status === "rejected");
  const canVoid = false;

  async function handleVoid() {
    try {
      await voidBill.mutateAsync(billId);
      navigate("/admin/billing");
    } catch {
      // Surfaced via voidBill.isError.
    }
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/admin/billing">
            <ArrowLeftIcon />
            Back to billing
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <PageHeader title={<>{bill.student?.name ?? `Bill #${bill.id}`}</>} description={<>{bill.student?.studentNumber ? `${bill.student.studentNumber} · ` : ""}
              {bill.student
                ? `${programLabel(bill.student.track, bill.student.yearLevel)} · `
                : ""}
              {termLabel}</>} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {role === "admin" && !dropping && <ClassificationDialog bill={bill} />}
            <Badge
              variant="outline"
              className={billStatusMeta(bill).className}
            >
              {billStatusMeta(bill).label}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={bill.amountPaid <= 0}
              onClick={() =>
                printBillReceipt(bill, {
                  name: bill.student?.name ?? `Bill #${bill.id}`,
                  studentNumber: bill.student?.studentNumber,
                  program: bill.student
                    ? programLabel(bill.student.track, bill.student.yearLevel)
                    : null,
                })
              }
            >
              <DownloadIcon />
              Download receipt
            </Button>
            {canVoid && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={voidBill.isPending}
                  >
                    <Trash2Icon />
                    Void bill
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Void this bill?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The bill, its credits and installment plan will be deleted
                      and {bill.student?.name ?? "the student"} returns to the
                      pending queue so you can re-generate it. Only possible while
                      no payment has been made.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={voidBill.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        void handleVoid();
                      }}
                    >
                      {voidBill.isPending ? "Voiding…" : "Void bill"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <BillCollectionNotice bill={bill} />
      <BillFinanceSummary bill={bill} staff />
      <DashboardMetricStrip metrics={[
        {label: "Net bill", value: formatPeso(bill.netTotal), detail: `${bill.items.length} fee items`, tone: "primary"},
        {label: "Student credit used", value: formatPeso(bill.creditApplied ?? 0), detail: "From previous payments", tone: "success"},
        {label: "Paid", value: formatPeso(bill.amountPaid), detail: "Verified payments", tone: "success"},
        {label: "Outstanding", value: formatPeso(bill.balance), detail: dropping ? collectionLabel(bill) : BILL_STATUS_META[bill.status].label, tone: bill.balance > 0 ? (dropping ? undefined : "warning") : "success"},
      ]} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]">
        {/* Summary */}
        <Card className="gap-0">
          <CardHeader>
            <CardTitle className="text-base">Bill summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <details className="py-3"><summary className="cursor-pointer text-sm font-medium">Fee breakdown · {bill.items.length} items</summary><dl className="mt-4 space-y-2">
              {bill.items.map((item) => (
                <SummaryRow
                  key={item.id}
                  label={item.name}
                  value={formatPeso(item.amount)}
                />
              ))}
            </dl></details>
            <div className="space-y-2 border-t pt-3">
              <SummaryRow label={bill.droppingAssessment ? "Original assessment" : "Gross total"} value={formatPeso(bill.total)} />
              {!isDroppingBill(bill) && bill.discountTotal > 0 && (
                <SummaryRow
                  label="Credits"
                  value={`− ${formatPeso(bill.discountTotal)}`}
                  muted
                />
              )}
              <SummaryRow label={bill.droppingAssessment ? "Final dropping charge" : "Net total"} value={formatPeso(bill.netTotal)} />
              {(bill.creditApplied ?? 0) > 0 && <SummaryRow label="Student credit used" value={formatPeso(bill.creditApplied ?? 0)} />}
              <SummaryRow label="Paid" value={formatPeso(bill.amountPaid)} />
            </div>
            <div className="border-t pt-3">
              <SummaryRow
                label="Balance due"
                value={formatPeso(bill.balance)}
                emphasize
              />
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {/* Credits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{bill.droppingAssessment ? "Original vouchers and incentives" : "Vouchers and incentives"}</CardTitle>
              <CardDescription>
                {bill.droppingAssessment ? "Historical awards retained for reference. They do not reduce the final dropping charge." : "Benefits captured when this bill was generated."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adjustments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No vouchers or tuition incentives were applied.
                </p>
              ) : (
                <ul className="divide-y">
                  {adjustments.map((adjustment) => (
                    <li
                      key={adjustment.id}
                      className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{adjustment.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {adjustment.type === "percentage"
                            ? `${adjustment.value}%`
                            : adjustment.type === "full"
                              ? "Full coverage"
                              : "Fixed"}
                        </p>
                        {(adjustment.reasons?.length ?? 0) > 0 && (
                          <p className="text-primary mt-1 text-xs">
                            Reason: {adjustment.reasons?.join(" + ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{bill.droppingAssessment ? "Historical" : "Applied"}</Badge>
                        <span className="text-sm font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                          {bill.droppingAssessment ? "" : "− "}{formatPeso(adjustment.amount)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Installment plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Installment plan</CardTitle>
              <CardDescription>
                {dropping ? "Historical dates are kept for reference." : bill.noDownpayment
                  ? "Downpayment waived — spread evenly over the school year."
                  : "Downpayment plus equal monthly payments, from the school year's policy."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dropping ? <DroppingSchedule bill={bill} /> : installments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No installment plan yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {installments.map((installment) => (
                    <li
                      key={installment.id}
                      className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {installment.label}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Due {installment.dueDate ?? "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {formatPeso(installment.amount)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "w-20 justify-center",
                            INSTALLMENT_STATUS_META[installment.status].className,
                          )}
                        >
                          {INSTALLMENT_STATUS_META[installment.status].label}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
              <CardDescription>Recorded payments for this bill.</CardDescription>
              <CardAction>
                {isPaymentReadOnly ? (
                  <Badge variant="outline">Cashier only</Badge>
                ) : (
                  <RecordPaymentDialog bill={bill} />
                )}
              </CardAction>
            </CardHeader>
            <CardContent>
              {isPaymentReadOnly && (
                <Alert className="mb-4">
                  <AlertTitle>Read-only for admins</AlertTitle>
                  <AlertDescription>
                    Admins can review payment records here, but only cashiers can
                    record, verify, reject, or void payments.
                  </AlertDescription>
                </Alert>
              )}
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No payments recorded yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                          {formatPeso(payment.amount)}
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            {paymentMethodLabel(payment.method)}
                          </span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {payment.paidAt ?? "—"}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                          {payment.recordedBy ? ` · by ${payment.recordedBy}` : ""}
                          {payment.submittedBy
                            ? ` · from ${payment.submittedBy}`
                            : ""}
                        </p>
                        {payment.proofUrl && (
                          <button
                            type="button"
                            onClick={() => setProofUrl(payment.proofUrl)}
                            className="text-primary text-xs underline"
                          >
                            View proof
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className={PAYMENT_STATUS_META[payment.status].className}
                        >
                          {PAYMENT_STATUS_META[payment.status].label}
                        </Badge>
                        {!isPaymentReadOnly && payment.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={verifyPayment.isPending}
                              onClick={() => verifyPayment.mutate(payment.id)}
                            >
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={rejectPayment.isPending}
                              onClick={() => rejectPayment.mutate(payment.id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {!isPaymentReadOnly && payment.status !== "pending" && !payment.creditProtected && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive size-8"
                            disabled={voidPayment.isPending}
                            onClick={() => voidPayment.mutate(payment.id)}
                          >
                            <Trash2Icon className="size-4" />
                            <span className="sr-only">Void payment</span>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentProofDialog
        url={proofUrl}
        onOpenChange={(open) => {
          if (!open) setProofUrl(null);
        }}
      />
    </div>
  );
}

export default BillDetailPage;
