import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { semesterLabel } from "@/features/terms/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useAllDiscounts } from "@/features/discounts/hooks";
import { discountValueLabel } from "@/features/discounts/types";
import {
  useApplyAdjustment,
  useBill,
  useRecordPayment,
  useRejectPayment,
  useRemoveAdjustment,
  useVerifyPayment,
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
        "flex justify-between gap-4",
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
          emphasize ? "font-semibold" : "font-medium",
          muted && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ApplyDiscountDialog({ bill }: { bill: Bill }) {
  const [open, setOpen] = useState(false);
  const [discountId, setDiscountId] = useState("");
  const { data: discounts } = useAllDiscounts();
  const apply = useApplyAdjustment(bill.id);

  const applied = new Set((bill.adjustments ?? []).map((a) => a.discountId));
  const available = (discounts ?? []).filter(
    (d) => d.isActive && !applied.has(d.id),
  );

  async function handleApply() {
    if (!discountId) return;
    try {
      await apply.mutateAsync(Number(discountId));
      setDiscountId("");
      setOpen(false);
    } catch {
      // Surfaced via apply.isError.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDiscountId("");
          apply.reset();
        }
        setOpen(next);
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        Apply discount
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply a discount</DialogTitle>
          <DialogDescription>
            Pick a discount, scholarship or voucher from the catalog to credit
            this bill.
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No more active discounts available to apply.{" "}
            <Link to="/admin/discounts" className="underline">
              Manage the catalog
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-1.5">
            <FieldLabel htmlFor="discount" required>
              Discount
            </FieldLabel>
            <Select value={discountId} onValueChange={setDiscountId}>
              <SelectTrigger id="discount" className="w-full">
                <SelectValue placeholder="Select discount" />
              </SelectTrigger>
              <SelectContent>
                {available.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name} ({discountValueLabel(d)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {apply.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(apply.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={apply.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!discountId || apply.isPending}
          >
            {apply.isPending ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
            Outstanding balance: {formatPeso(bill.balance)}.
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
  const billId = Number(id);
  const { data: bill, isLoading, isError, refetch } = useBill(billId);
  const removeAdjustment = useRemoveAdjustment(billId);
  const voidPayment = useVoidPayment(billId);
  const verifyPayment = useVerifyPayment(billId);
  const rejectPayment = useRejectPayment(billId);
  const programLabel = useProgramLabel();

  const termLabel = useMemo(() => {
    if (!bill?.schoolYear) return "—";
    return `${semesterLabel(bill.semester ?? "")} · SY ${bill.schoolYear}`;
  }, [bill]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (isError || !bill) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
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
  const installments = bill.installments ?? [];
  const payments = bill.payments ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/admin/billing">
            <ArrowLeftIcon />
            Back to billing
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {bill.student?.name ?? `Bill #${bill.id}`}
            </h1>
            <p className="text-muted-foreground text-sm">
              {bill.student?.studentNumber ? `${bill.student.studentNumber} · ` : ""}
              {bill.student
                ? `${programLabel(bill.student.track, bill.student.yearLevel)} · `
                : ""}
              {termLabel}
            </p>
          </div>
          <Badge
            variant="outline"
            className={BILL_STATUS_META[bill.status].className}
          >
            {BILL_STATUS_META[bill.status].label}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2">
              {bill.items.map((item) => (
                <SummaryRow
                  key={item.id}
                  label={item.name}
                  value={formatPeso(item.amount)}
                />
              ))}
            </dl>
            <div className="space-y-2 border-t pt-3">
              <SummaryRow label="Gross total" value={formatPeso(bill.total)} />
              {bill.discountTotal > 0 && (
                <SummaryRow
                  label="Discounts"
                  value={`− ${formatPeso(bill.discountTotal)}`}
                  muted
                />
              )}
              <SummaryRow
                label="Net total"
                value={formatPeso(bill.netTotal)}
                emphasize
              />
              <SummaryRow label="Paid" value={formatPeso(bill.amountPaid)} />
              <SummaryRow
                label="Balance"
                value={formatPeso(bill.balance)}
                emphasize
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {/* Discounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discounts</CardTitle>
              <CardDescription>
                Credits applied to this bill from the catalog.
              </CardDescription>
              <CardAction>
                <ApplyDiscountDialog bill={bill} />
              </CardAction>
            </CardHeader>
            <CardContent>
              {adjustments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No discounts applied.
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
                            : "Fixed"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          − {formatPeso(adjustment.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-8"
                          disabled={removeAdjustment.isPending}
                          onClick={() =>
                            removeAdjustment.mutate(adjustment.id)
                          }
                        >
                          <Trash2Icon className="size-4" />
                          <span className="sr-only">Remove discount</span>
                        </Button>
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
                {bill.noDownpayment
                  ? "Downpayment waived — spread evenly over the school year."
                  : "Downpayment plus equal monthly payments, from the school year's policy."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {installments.length === 0 ? (
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
                        <span className="text-sm font-medium">
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
                <RecordPaymentDialog bill={bill} />
              </CardAction>
            </CardHeader>
            <CardContent>
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
                        <p className="text-sm font-medium">
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
                          <a
                            href={payment.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs underline"
                          >
                            View proof
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className={PAYMENT_STATUS_META[payment.status].className}
                        >
                          {PAYMENT_STATUS_META[payment.status].label}
                        </Badge>
                        {payment.status === "pending" && (
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
                        {payment.status !== "pending" && (
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
    </div>
  );
}

export default BillDetailPage;
