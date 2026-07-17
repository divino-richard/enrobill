import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/form/field-label";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatDate } from "@/features/applications/utils";
import { useActivePaymentChannels } from "@/features/payment-channels/hooks";
import type { PaymentChannel } from "@/features/payment-channels/types";
import { uploadPaymentProof } from "@/features/bills/api";
import { printBillReceipt } from "@/features/bills/receipt";
import { useSubmitMyPayment } from "@/features/bills/hooks";
import { useAuthStore } from "@/features/auth/store";
import {
  BILL_STATUS_META,
  type Bill,
  type PaymentMethod,
} from "@/features/bills/types";
import {
  billReceiptParty,
  isOverdue,
  nextOutstandingInstallment,
  termTitle,
} from "@/features/bills/utils";

const todayIso = () => new Date().toISOString().slice(0, 10);

function AccountRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="ml-auto truncate font-medium tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={copy}
        aria-label={`Copy ${label}`}
      >
        {copied ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
          {n}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function HeroStat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 bg-background px-4 py-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "tabular-nums",
          strong ? "text-base font-semibold" : "text-sm font-medium",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function billReference(id: number) {
  return `BILL-${String(id).padStart(5, "0")}`;
}

function BillHeroHeader({
  bill,
  isCurrentBill,
  statusLabel,
  statusClassName,
  settled,
}: {
  bill: Bill;
  isCurrentBill: boolean;
  statusLabel: string;
  statusClassName: string;
  settled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        settled
          ? "border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/20"
          : "bg-muted/15",
      )}
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            {termTitle(bill)}
          </h2>
          <Badge variant="secondary" className="h-6 font-normal">
            {isCurrentBill ? "Current bill" : "Past bill"}
          </Badge>
          <Badge variant="outline" className={cn("h-6", statusClassName)}>
            {statusLabel}
          </Badge>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>{billReference(bill.id)}</span>
          <span>Issued {formatDate(bill.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function PayDialog({
  bill,
  channels,
  disabled,
  triggerClassName,
  triggerLabel = "Pay now",
}: {
  bill: Bill;
  channels: PaymentChannel[];
  disabled?: boolean;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const methods = channels.map((channel) => ({
    value: channel.code,
    label: channel.label,
  }));
  const submit = useSubmitMyPayment();
  const nextDue = nextOutstandingInstallment(bill.installments ?? []);
  const hasImmediateDue = bill.amountDue > 0;
  const minimumAmount = hasImmediateDue ? bill.amountDue : Math.min(0.01, bill.balance);
  const suggestedAmount = hasImmediateDue
    ? bill.amountDue
    : nextDue?.balance ?? bill.balance;
  const suggestedLabel = hasImmediateDue
    ? "Due now"
    : nextDue
      ? "Next installment"
      : "Suggested amount";

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(suggestedAmount));
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function reset() {
    setAmount(String(suggestedAmount));
    setMethod(methods[0]?.value ?? "");
    setReference("");
    setPaidAt(todayIso());
    setNote("");
    setFile(null);
    setError(null);
    submit.reset();
  }

  const amountNum = Number(amount);
  const amountValid =
    amount !== "" &&
    amountNum >= minimumAmount - 0.0001 &&
    amountNum <= bill.balance + 0.01;

  const selectedChannel = channels.find((channel) => channel.code === method) ?? null;
  const isBank = selectedChannel?.code === "bank";

  async function handleSubmit() {
    setError(null);
    if (!method || !file || !amountValid) return;
    try {
      setUploading(true);
      const proofKey = await uploadPaymentProof(file);
      setUploading(false);
      await submit.mutateAsync({
        amount: amountNum,
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
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={triggerClassName}
      >
        <UploadIcon />
        {triggerLabel}
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pay your bill</DialogTitle>
          <DialogDescription>
            {hasImmediateDue
              ? "Choose how to pay, settle the amount due, then upload your receipt for review."
              : "Nothing is due right now, but you can prepay your next installment or settle the remaining balance."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Step n={1} title="Amount to pay">
            <p className="text-muted-foreground text-xs">
              Tap an amount, or type your own below.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAmount(String(suggestedAmount))}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  Math.abs(amountNum - suggestedAmount) < 0.01
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <p className="text-muted-foreground text-xs">{suggestedLabel}</p>
                <p className="font-semibold tabular-nums">
                  {formatPeso(suggestedAmount)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setAmount(String(bill.balance))}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  Math.abs(amountNum - bill.balance) < 0.01
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <p className="text-muted-foreground text-xs">Full balance</p>
                <p className="font-semibold tabular-nums">
                  {formatPeso(bill.balance)}
                </p>
              </button>
            </div>
            <Input
              id="pay-amount"
              type="number"
              min={minimumAmount}
              max={bill.balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {amount !== "" && !amountValid ? (
              <p className="text-destructive text-xs">
                {hasImmediateDue
                  ? `Enter between ${formatPeso(bill.amountDue)} and ${formatPeso(
                      bill.balance,
                    )}.`
                  : `Enter more than 0 and up to ${formatPeso(bill.balance)}.`}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                {hasImmediateDue
                  ? "Pay the amount due, or more to lower your future monthly payments."
                  : "You can prepay part of your balance or settle the bill in full."}
              </p>
            )}
          </Step>

          {channels.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              Online payment is not set up yet. Please pay at the cashier.
            </p>
          ) : (
            <>
              <Step n={2} title="Pay with">
                <div className="flex flex-wrap gap-1.5">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setMethod(channel.code)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        method === channel.code
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {channel.label}
                    </button>
                  ))}
                </div>

                {selectedChannel && (
                  <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
                    {selectedChannel.qrUrl && (
                      <div className="flex flex-col items-center gap-1.5">
                        <img
                          src={selectedChannel.qrUrl}
                          alt={`${selectedChannel.label} QR`}
                          className="size-36 rounded-md border bg-white object-contain p-1.5"
                        />
                        <p className="text-muted-foreground text-xs">
                          Scan with your {selectedChannel.label} app
                        </p>
                      </div>
                    )}

                    {(selectedChannel.accountName ||
                      selectedChannel.accountNumber) && (
                      <div className="space-y-1.5">
                        {selectedChannel.accountName && (
                          <AccountRow
                            label={isBank ? "Bank" : "Account name"}
                            value={selectedChannel.accountName}
                          />
                        )}
                        {selectedChannel.accountNumber && (
                          <AccountRow
                            label={isBank ? "Account number" : "Number"}
                            value={selectedChannel.accountNumber}
                          />
                        )}
                      </div>
                    )}

                    {!selectedChannel.qrUrl &&
                      !selectedChannel.accountName &&
                      !selectedChannel.accountNumber && (
                        <p className="text-muted-foreground text-center text-sm">
                          No payment details yet. Please contact the cashier.
                        </p>
                      )}
                  </div>
                )}
              </Step>

              <Step n={3} title="Confirm your payment">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="pay-date" required>
                        Date paid
                      </FieldLabel>
                      <Input
                        id="pay-date"
                        type="date"
                        value={paidAt}
                        onChange={(event) => setPaidAt(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="pay-ref">Reference no.</FieldLabel>
                      <Input
                        id="pay-ref"
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="pay-proof" required>
                      Proof of payment
                    </FieldLabel>
                    <Input
                      id="pay-proof"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    <p className="text-muted-foreground text-xs">
                      A screenshot or photo of your receipt (PNG or JPG).
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="pay-note">Note (optional)</FieldLabel>
                    <Textarea
                      id="pay-note"
                      rows={2}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                </div>
              </Step>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !method || !file || !amountValid || channels.length === 0 || busy
            }
          >
            {uploading
              ? "Uploading..."
              : submit.isPending
                ? "Submitting..."
                : "Submit for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BillActionPanel({
  bill,
  currentBill,
}: {
  bill: Bill;
  currentBill: Bill | null;
}) {
  const { data: channels } = useActivePaymentChannels();
  const userName = useAuthStore((state) => state.user?.name) ?? "Student";
  const isCurrentBill = currentBill?.id === bill.id;
  const pendingTotal = (bill.payments ?? [])
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const nextDue = nextOutstandingInstallment(bill.installments ?? []);

  const status = BILL_STATUS_META[bill.status];
  const hasPending = pendingTotal > 0;
  const dueOverdue = isOverdue(nextDue?.dueDate ?? null);
  const paidPct =
    bill.netTotal > 0
      ? Math.min(100, Math.round((bill.amountPaid / bill.netTotal) * 100))
      : 100;
  const paymentSummary = `${formatPeso(bill.amountPaid)} paid of ${formatPeso(
    bill.netTotal,
  )}`;
  const completionSummary =
    paidPct >= 100 ? "Fully settled" : `${paidPct}% complete`;
  const primaryLabel =
    bill.balance <= 0
      ? "Bill status"
      : bill.amountDue > 0
        ? "Amount due now"
        : "Balance remaining";
  const primaryValue = bill.amountDue > 0 ? bill.amountDue : bill.balance;
  const primaryValueClassName =
    bill.amountDue > 0
      ? dueOverdue
        ? "text-red-600 dark:text-red-400"
        : "text-amber-700 dark:text-amber-300"
      : "text-foreground";
  const dueLine =
    bill.amountDue > 0 && nextDue?.dueDate
      ? `${dueOverdue ? "Overdue since" : "Due"} ${formatDate(nextDue.dueDate)}`
      : nextDue
        ? `Next installment ${formatPeso(nextDue.balance)}${
            nextDue.dueDate ? ` on ${formatDate(nextDue.dueDate)}` : ""
          }`
        : "No installment due date is scheduled.";
  const actionSummary = isCurrentBill
    ? bill.amountDue > 0
      ? "Pay online and submit proof for verification."
      : "Advance payment is available on this bill."
    : currentBill
      ? "Online payment is available on the current term bill only."
      : "Contact the cashier to settle this balance.";
  const cardTone = bill.balance <= 0 ? "border-emerald-200/70" : "border-border";

  if (bill.balance <= 0) {
    return (
      <Card className={cn("overflow-hidden py-0", cardTone)}>
        <CardContent className="p-0">
          <BillHeroHeader
            bill={bill}
            isCurrentBill={isCurrentBill}
            statusLabel={status.label}
            statusClassName={status.className}
            settled
          />
          <div className="grid gap-px border-t bg-border lg:grid-cols-[minmax(0,1.4fr)_11rem_11rem_11rem_16rem]">
            <div className="space-y-2 bg-card px-4 py-4">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {primaryLabel}
              </p>
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <CheckCircle2Icon className="size-4" />
                </div>
                <p className="text-2xl font-semibold tracking-tight">Settled</p>
              </div>
              <p className="text-muted-foreground text-sm">
                {paymentSummary} · Nothing is due.
              </p>
            </div>

            <HeroStat label="Net total" value={formatPeso(bill.netTotal)} />
            <HeroStat label="Paid" value={formatPeso(bill.amountPaid)} />
            <HeroStat label="Balance" value={formatPeso(bill.balance)} strong />

            <div className="flex flex-col gap-2 bg-card px-4 py-3">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Actions
              </p>
              {bill.amountPaid > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent"
                  onClick={() =>
                    printBillReceipt(bill, billReceiptParty(bill, userName))
                  }
                >
                  <DownloadIcon />
                  Receipt
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden py-0", cardTone)}>
      <CardContent className="p-0">
        <BillHeroHeader
          bill={bill}
          isCurrentBill={isCurrentBill}
          statusLabel={status.label}
          statusClassName={status.className}
        />
        <div className="grid gap-px border-t bg-border lg:grid-cols-[minmax(0,1.4fr)_11rem_11rem_11rem_16rem]">
          <div className="space-y-2 bg-card px-4 py-4">
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {primaryLabel}
              </p>
              <p
                className={cn(
                  "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
                  primaryValueClassName,
                )}
              >
                {formatPeso(primaryValue)}
              </p>
              <div className="space-y-1 text-sm">
                {bill.amountDue > 0 && nextDue?.dueDate ? (
                  <p
                    className={cn(
                      "flex items-center gap-1.5",
                      dueOverdue
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {dueOverdue ? (
                      <TriangleAlertIcon className="size-3.5" />
                    ) : (
                      <CalendarClockIcon className="size-3.5" />
                    )}
                    {dueLine}
                  </p>
                ) : (
                  <p className="font-medium">{dueLine}</p>
                )}
                <p className="text-muted-foreground">
                  {paymentSummary} · {completionSummary}
                </p>
              </div>
            </div>
          </div>

          <HeroStat label="Net total" value={formatPeso(bill.netTotal)} />
          <HeroStat label="Paid" value={formatPeso(bill.amountPaid)} />
          <HeroStat label="Balance" value={formatPeso(bill.balance)} strong />

          <div className="flex flex-col gap-2 bg-card px-4 py-3">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Actions
            </p>
            <p className="text-muted-foreground text-xs">{actionSummary}</p>

            <div className="flex flex-col gap-2">
              {isCurrentBill ? (
                <PayDialog
                  bill={bill}
                  channels={channels ?? []}
                  disabled={hasPending}
                  triggerClassName="w-full"
                  triggerLabel={bill.amountDue > 0 ? "Pay now" : "Prepay now"}
                />
              ) : (
                currentBill && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={`/portal/bills/${currentBill.id}`}>
                      Open current bill
                    </Link>
                  </Button>
                )
              )}
              {bill.amountPaid > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    printBillReceipt(bill, billReceiptParty(bill, userName))
                  }
                >
                  <DownloadIcon />
                  Receipt
                </Button>
              )}
            </div>

            {hasPending && (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <ClockIcon className="mt-0.5 size-3 shrink-0" />
                {formatPeso(pendingTotal)} awaiting verification.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
