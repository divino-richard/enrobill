import { useState } from "react";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  ReceiptTextIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatDate } from "@/features/applications/utils";
import { semesterLabel } from "@/features/terms/types";
import { useActivePaymentChannels } from "@/features/payment-channels/hooks";
import type { PaymentChannel } from "@/features/payment-channels/types";
import { uploadPaymentProof } from "@/features/bills/api";
import {
  useChooseMyPlan,
  useMyBill,
  useMyBills,
  useSubmitMyPayment,
} from "@/features/bills/hooks";
import {
  BILL_STATUS_META,
  INSTALLMENT_STATUS_META,
  PAYMENT_STATUS_META,
  paymentMethodLabel,
  type Bill,
  type PaymentMethod,
} from "@/features/bills/types";

const todayIso = () => new Date().toISOString().slice(0, 10);

const termTitle = (bill: Bill) =>
  `${semesterLabel(bill.semester ?? "")} · SY ${bill.schoolYear}`;

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

// A KPI tile for the current-bill overview.
function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        accent && "border-primary/20 bg-primary/5",
      )}
    >
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tracking-tight tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

// Read-only full breakdown of a bill (used for both the current bill and past
// bills).
function BillDetailDialog({
  bill,
  onOpenChange,
}: {
  bill: Bill | null;
  onOpenChange: (open: boolean) => void;
}) {
  const installments = bill?.installments ?? [];
  const payments = bill?.payments ?? [];

  return (
    <Dialog open={bill !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bill ? termTitle(bill) : "Bill"}</DialogTitle>
          <DialogDescription>Full breakdown of this bill.</DialogDescription>
        </DialogHeader>
        {bill && (
          <div className="space-y-5">
            <div>
              <dl className="space-y-2">
                {bill.items.map((item) => (
                  <SummaryRow
                    key={item.id}
                    label={item.name}
                    value={formatPeso(item.amount)}
                  />
                ))}
              </dl>
              <div className="mt-2 space-y-2 border-t pt-3">
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
            </div>

            {installments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Payment schedule</p>
                <ul className="divide-y rounded-lg border px-3">
                  {installments.map((installment) => (
                    <li
                      key={installment.id}
                      className="flex items-center justify-between gap-4 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{installment.label}</p>
                        <p className="text-muted-foreground text-xs">
                          Due {formatDate(installment.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
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
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Payments</p>
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No payments yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border px-3">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-4 py-2 text-sm"
                    >
                      <span>
                        {formatPeso(payment.amount)}
                        <span className="text-muted-foreground ml-2 text-xs">
                          {paymentMethodLabel(payment.method)} ·{" "}
                          {formatDate(payment.paidAt)}
                        </span>
                      </span>
                      <Badge
                        variant="outline"
                        className={PAYMENT_STATUS_META[payment.status].className}
                      >
                        {PAYMENT_STATUS_META[payment.status].label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// QR codes + the payment-submission form, in one focused dialog.
function PayDialog({
  bill,
  channels,
  disabled,
}: {
  bill: Bill;
  channels: PaymentChannel[];
  disabled?: boolean;
}) {
  const methods = channels.map((c) => ({ value: c.code, label: c.label }));
  const submit = useSubmitMyPayment();

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function reset() {
    setMethod(methods[0]?.value ?? "");
    setReference("");
    setPaidAt(todayIso());
    setNote("");
    setFile(null);
    setError(null);
    submit.reset();
  }

  async function handleSubmit() {
    setError(null);
    if (!method || !file) return;
    try {
      setUploading(true);
      const proofKey = await uploadPaymentProof(file);
      setUploading(false);
      await submit.mutateAsync({
        method: method as PaymentMethod,
        reference: reference.trim() || null,
        proofKey,
        paidAt,
        note: note.trim() || null,
      });
      setOpen(false);
    } catch (err) {
      setUploading(false);
      setError(getErrorMessage(err));
    }
  }

  const busy = uploading || submit.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <Button onClick={() => setOpen(true)} disabled={disabled}>
        <UploadIcon />
        Pay now
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay your bill</DialogTitle>
          <DialogDescription>
            Pay the amount due via GCash or Maya, then upload your receipt for
            review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-muted-foreground text-sm">Amount to pay</span>
            <span className="text-lg font-semibold">
              {formatPeso(bill.amountDue)}
            </span>
          </div>

          {channels.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Online payment isn't set up yet. Please pay at the cashier.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="space-y-1 rounded-lg border p-3 text-center"
                  >
                    <p className="text-sm font-medium">{channel.label}</p>
                    {channel.qrUrl && (
                      <img
                        src={channel.qrUrl}
                        alt={`${channel.label} QR`}
                        className="mx-auto size-32 object-contain"
                      />
                    )}
                    {channel.accountName && (
                      <p className="text-muted-foreground text-xs">
                        {channel.accountName}
                        {channel.accountNumber
                          ? ` · ${channel.accountNumber}`
                          : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="pay-method" required>
                    Method
                  </FieldLabel>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger id="pay-method" className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="pay-date" required>
                    Date paid
                  </FieldLabel>
                  <Input
                    id="pay-date"
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="pay-ref">Reference no.</FieldLabel>
                  <Input
                    id="pay-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="pay-proof" required>
                    Proof of payment (screenshot)
                  </FieldLabel>
                  <Input
                    id="pay-proof"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <FieldLabel htmlFor="pay-note">Note</FieldLabel>
                  <Textarea
                    id="pay-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!method || !file || channels.length === 0 || busy}
          >
            {uploading
              ? "Uploading…"
              : submit.isPending
                ? "Submitting…"
                : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// In-card prompt to pick full vs installment before paying. Selecting a plan
// opens a confirmation modal first, since the choice is locked after paying.
function ChoosePlan({ bill }: { bill: Bill }) {
  const choose = useChooseMyPlan();
  const [pendingPlan, setPendingPlan] = useState<"full" | "installment" | null>(
    null,
  );
  const policy = bill.installmentPolicy;
  const downpayment = policy
    ? policy.downpaymentType === "percentage"
      ? Math.round(bill.netTotal * ((policy.downpaymentValue ?? 0) / 100) * 100) /
        100
      : Math.min(policy.downpaymentValue ?? 0, bill.netTotal)
    : 0;

  const openConfirm = (plan: "full" | "installment") => {
    choose.reset();
    setPendingPlan(plan);
  };

  const confirm = () => {
    if (!pendingPlan) return;
    // Keep the modal open until it succeeds; on success the parent stops
    // rendering this prompt (a plan is now set), unmounting the modal.
    choose.mutate(pendingPlan);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Choose how to pay</p>
        <p className="text-muted-foreground text-xs">
          Pick a plan to continue. You can't change it once you've paid.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={choose.isPending}
          onClick={() => openConfirm("full")}
          className="hover:border-primary rounded-lg border p-3 text-left transition-colors"
        >
          <p className="text-sm font-medium">Pay in full</p>
          <p className="text-muted-foreground text-xs">
            {formatPeso(bill.netTotal)} in one payment.
          </p>
        </button>
        <button
          type="button"
          disabled={choose.isPending}
          onClick={() => openConfirm("installment")}
          className="hover:border-primary rounded-lg border p-3 text-left transition-colors"
        >
          <p className="text-sm font-medium">Installments</p>
          <p className="text-muted-foreground text-xs">
            {formatPeso(downpayment)} down, then {policy?.installmentCount ?? 0}{" "}
            monthly.
          </p>
        </button>
      </div>

      <AlertDialog
        open={pendingPlan !== null}
        onOpenChange={(open) => {
          if (!open && !choose.isPending) setPendingPlan(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPlan === "full"
                ? "Pay in full?"
                : "Pay by installments?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPlan === "full"
                ? `You'll pay ${formatPeso(bill.netTotal)} in a single payment. Your payment plan can't be changed once a payment is made or under review.`
                : `You'll pay ${formatPeso(downpayment)} as a down payment now, then ${policy?.installmentCount ?? 0} monthly installments. Your payment plan can't be changed once a payment is made or under review.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {choose.isError && (
            <p className="text-destructive text-sm">
              {getErrorMessage(choose.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={choose.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={choose.isPending}
              onClick={(e) => {
                // Prevent the default auto-close so the modal stays up while the
                // request is in flight (and on error).
                e.preventDefault();
                confirm();
              }}
            >
              {choose.isPending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoryCard({
  bills,
  onView,
}: {
  bills: Bill[];
  onView: (bill: Bill) => void;
}) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Bill history</CardTitle>
        <CardDescription>Past and settled bills.</CardDescription>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="text-muted-foreground text-sm">No previous bills yet.</p>
        ) : (
          <ul className="space-y-1">
            {bills.map((past) => (
              <li key={past.id}>
                <button
                  type="button"
                  onClick={() => onView(past)}
                  className="hover:bg-muted/60 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                      <ReceiptTextIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {termTitle(past)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Balance {formatPeso(past.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={BILL_STATUS_META[past.status].className}
                    >
                      {BILL_STATUS_META[past.status].label}
                    </Badge>
                    <ChevronRightIcon className="text-muted-foreground size-4" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BillsPage() {
  const { data: bill, isLoading } = useMyBill();
  const { data: allBills } = useMyBills();
  const { data: channels } = useActivePaymentChannels();
  const payChannels = channels ?? [];
  const [detailBill, setDetailBill] = useState<Bill | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-56 w-full rounded-md" />
      </div>
    );
  }

  // The open-term bill counts as "current" only while it still needs paying.
  // Once it's fully settled it drops down into history (no duplicate card).
  const currentBill = bill && bill.balance > 0 ? bill : null;
  const settledBill = bill && bill.balance <= 0 ? bill : null;
  const history = (allBills ?? []).filter((b) => b.id !== currentBill?.id);

  if (!currentBill && history.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Bills</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
            <ReceiptTextIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No bills yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              Your bill for the current term hasn't been issued yet. Please check
              back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const paidPct =
    currentBill && currentBill.netTotal > 0
      ? Math.min(
          100,
          Math.round((currentBill.amountPaid / currentBill.netTotal) * 100),
        )
      : 0;
  const pendingPayments = (currentBill?.payments ?? []).filter(
    (p) => p.status === "pending",
  );
  const pendingTotal = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const hasPending = pendingPayments.length > 0;
  const nextInstallment =
    (currentBill?.installments ?? []).find((i) => i.status !== "paid") ?? null;
  const mustChoosePlan =
    !!currentBill &&
    currentBill.installmentsAllowed &&
    currentBill.paymentOption === null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Bills</h1>
        <p className="text-muted-foreground text-sm">
          Your current bill and payment history.
        </p>
      </div>

      {currentBill ? (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Current bill</CardTitle>
              <CardDescription>{termTitle(currentBill)}</CardDescription>
              <CardAction>
                <Badge
                  variant="outline"
                  className={BILL_STATUS_META[currentBill.status].className}
                >
                  {BILL_STATUS_META[currentBill.status].label}
                </Badge>
              </CardAction>
            </CardHeader>

            <CardContent className="space-y-4">
              {mustChoosePlan ? (
                <ChoosePlan bill={currentBill} />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatTile
                      label="Amount due now"
                      value={formatPeso(currentBill.amountDue)}
                      accent
                    />
                    <StatTile
                      label="Total balance"
                      value={formatPeso(currentBill.balance)}
                    />
                    <StatTile
                      label="Paid"
                      value={formatPeso(currentBill.amountPaid)}
                      hint={`${paidPct}% of ${formatPeso(currentBill.netTotal)}`}
                    />
                  </div>

                  <div
                    className="bg-muted h-2 w-full overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={paidPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>

                  {nextInstallment?.dueDate && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <CalendarClockIcon className="size-4" />
                        Next payment
                      </span>
                      <span className="font-medium">
                        {formatPeso(nextInstallment.amount)} · due{" "}
                        {formatDate(nextInstallment.dueDate)}
                      </span>
                    </div>
                  )}

                  {hasPending && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      <ClockIcon className="size-4 shrink-0" />
                      {formatPeso(pendingTotal)} awaiting verification — you can
                      submit another payment once it's reviewed.
                    </div>
                  )}
                </>
              )}
            </CardContent>

            {!mustChoosePlan && (
              <CardFooter className="gap-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setDetailBill(currentBill)}
                >
                  <EyeIcon />
                  View details
                </Button>
                <PayDialog
                  bill={currentBill}
                  channels={payChannels}
                  disabled={hasPending}
                />
              </CardFooter>
            )}
          </Card>

          <HistoryCard bills={history} onView={setDetailBill} />
        </div>
      ) : (
        <div className="space-y-6">
          {settledBill && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <CheckCircle2Icon className="size-5 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  You're all paid up for {termTitle(settledBill)}
                </p>
                <p className="text-xs">
                  Your current bill is fully settled — find it in your history
                  below.
                </p>
              </div>
            </div>
          )}
          <HistoryCard bills={history} onView={setDetailBill} />
        </div>
      )}

      <BillDetailDialog
        bill={detailBill}
        onOpenChange={(open) => {
          if (!open) setDetailBill(null);
        }}
      />
    </div>
  );
}

export default BillsPage;
