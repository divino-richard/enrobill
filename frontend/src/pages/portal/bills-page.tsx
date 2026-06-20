import { useState } from "react";
import { ReceiptTextIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
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
import { useActivePaymentChannels } from "@/features/payment-channels/hooks";
import { uploadPaymentProof } from "@/features/bills/api";
import {
  useChooseMyPlan,
  useMyBill,
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
      className={cn("flex justify-between gap-4", emphasize ? "text-base" : "text-sm")}
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

function SubmitPaymentDialog({
  bill,
  methods,
}: {
  bill: Bill;
  methods: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const submit = useSubmitMyPayment();

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
      <Button onClick={() => setOpen(true)} disabled={bill.amountDue <= 0}>
        <UploadIcon />
        Submit payment
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit a payment</DialogTitle>
          <DialogDescription>
            Pay the amount due via GCash or Maya using the QR code, then upload
            your receipt screenshot. Your payment is reviewed before it's applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-muted-foreground text-sm">Amount to pay</span>
            <span className="text-lg font-semibold">
              {formatPeso(bill.amountDue)}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="method" required>
                Method
              </FieldLabel>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="method" className="w-full">
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
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="reference">Reference no.</FieldLabel>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="proof" required>
              Proof of payment (screenshot)
            </FieldLabel>
            <Input
              id="proof"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
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

        {error && <p className="text-destructive text-sm">{error}</p>}

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
            disabled={!method || !file || bill.amountDue <= 0 || busy}
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

function ChoosePlanCard({ bill }: { bill: Bill }) {
  const choose = useChooseMyPlan();
  const policy = bill.installmentPolicy;
  const downpayment = policy
    ? policy.downpaymentType === "percentage"
      ? Math.round(bill.netTotal * ((policy.downpaymentValue ?? 0) / 100) * 100) /
        100
      : Math.min(policy.downpaymentValue ?? 0, bill.netTotal)
    : 0;

  return (
    <Card className="lg:col-span-1 h-fit">
      <CardHeader>
        <CardTitle className="text-base">Choose how to pay</CardTitle>
        <CardDescription>
          Pick a plan to continue. You can't change it once you've paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          type="button"
          disabled={choose.isPending}
          onClick={() => choose.mutate("full")}
          className="hover:border-primary w-full rounded-lg border p-3 text-left transition-colors"
        >
          <p className="text-sm font-medium">Pay in full</p>
          <p className="text-muted-foreground text-xs">
            One payment of {formatPeso(bill.netTotal)}.
          </p>
        </button>
        <button
          type="button"
          disabled={choose.isPending}
          onClick={() => choose.mutate("installment")}
          className="hover:border-primary w-full rounded-lg border p-3 text-left transition-colors"
        >
          <p className="text-sm font-medium">Pay in installments</p>
          <p className="text-muted-foreground text-xs">
            {formatPeso(downpayment)} downpayment now, then{" "}
            {policy?.installmentCount ?? 0} monthly payments.
          </p>
        </button>
        {choose.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(choose.error)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BillsPage() {
  const { data: bill, isLoading, isError } = useMyBill();
  const { data: channels } = useActivePaymentChannels();
  const payChannels = channels ?? [];
  const methodOptions = payChannels.map((c) => ({
    value: c.code,
    label: c.label,
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  // A 404 (no bill yet) also lands here.
  if (isError || !bill) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Bill</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
            <ReceiptTextIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No bill yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              Your bill for the current term hasn't been issued yet. Please check
              back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const installments = bill.installments ?? [];
  const payments = bill.payments ?? [];

  // The student must pick full vs installment before paying, when the term
  // offers installments and they haven't chosen (and haven't paid) yet.
  const mustChoosePlan =
    bill.installmentsAllowed && bill.paymentOption === null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Bill</h1>
          <p className="text-muted-foreground text-sm">
            {semesterLabel(bill.semester ?? "")} · SY {bill.schoolYear}
          </p>
        </div>
        <Badge variant="outline" className={BILL_STATUS_META[bill.status].className}>
          {BILL_STATUS_META[bill.status].label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Summary */}
          <Card>
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

          {/* Installments */}
          {installments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {installments.map((installment) => (
                    <li
                      key={installment.id}
                      className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{installment.label}</p>
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
              </CardContent>
            </Card>
          )}

          {/* Payment history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment history</CardTitle>
              <CardDescription>
                Submitted payments are reviewed before they're applied.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No payments yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {formatPeso(payment.amount)}
                          <span className="text-muted-foreground ml-2 text-xs font-normal">
                            {paymentMethodLabel(payment.method)}
                          </span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {payment.paidAt ?? "—"}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                        </p>
                      </div>
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
            </CardContent>
          </Card>
        </div>

        {/* Pay panel — or the plan choice when one is required first */}
        {mustChoosePlan ? (
          <ChoosePlanCard bill={bill} />
        ) : (
          <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base">Pay your bill</CardTitle>
            <CardDescription>
              Scan a QR code with your e-wallet, then submit your receipt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {payChannels.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Online payment isn't set up yet. Please pay at the cashier.
              </p>
            ) : (
              <>
                {payChannels.map((channel) => (
                  <div key={channel.id} className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">{channel.label}</p>
                    {channel.qrUrl && (
                      <img
                        src={channel.qrUrl}
                        alt={`${channel.label} QR`}
                        className="mx-auto size-40 object-contain"
                      />
                    )}
                    {channel.accountName && (
                      <p className="text-muted-foreground text-center text-xs">
                        {channel.accountName}
                        {channel.accountNumber
                          ? ` · ${channel.accountNumber}`
                          : ""}
                      </p>
                    )}
                  </div>
                ))}
                <SubmitPaymentDialog bill={bill} methods={methodOptions} />
              </>
            )}
          </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default BillsPage;
