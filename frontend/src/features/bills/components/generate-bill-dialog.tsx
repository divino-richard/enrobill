import { GiftIcon, InfoIcon, LockIcon, TicketPercentIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import type { EnrollmentVoucher } from "@/features/enrollments/types";
import { useEligibleFreebies } from "@/features/freebies/hooks";
import { useGenerateBillForEnrollment } from "@/features/bills/hooks";

// e.g. "₱7,000.00" for a fixed voucher, "50%" for a percentage one.
function voucherValueLabel(voucher: EnrollmentVoucher): string {
  if (voucher.type === "full") return "Full coverage";
  return voucher.type === "percentage"
    ? `${voucher.value}%`
    : formatPeso(voucher.value);
}

// The minimal data the dialog needs about the enrollment being billed. The
// voucher is whatever the admin granted on acceptance — the cashier sees it but
// cannot change it here.
export interface GenerateBillTarget {
  enrollmentId: number;
  name: string;
  feePreview: number;
  voucher: EnrollmentVoucher | null;
}

// Mirror the backend voucher math (Bill::creditFor): the credit caps at the
// remaining balance.
function previewNet(gross: number, voucher: EnrollmentVoucher | null): number {
  if (!voucher) return gross;
  const nominal =
    voucher.type === "percentage"
      ? (gross * voucher.value) / 100
      : voucher.value;
  return Math.max(
    Math.round((gross - Math.min(nominal, gross)) * 100) / 100,
    0,
  );
}

// A credit that will be applied to the bill. Both kinds are derived rather than
// chosen, so the row is a statement of fact, not a control.
function CreditRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
      <LockIcon className="text-muted-foreground size-4 shrink-0" />
      <span className="flex-1 font-medium">{title}</span>
      <span className="text-primary text-xs font-medium">{meta}</span>
    </div>
  );
}

// A muted, dashed placeholder for empty/locked option sections.
function EmptyHint({
  icon: Icon,
  children,
}: {
  icon: typeof InfoIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs">
      <Icon className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function GenerateBillDialog({
  enrollment,
  open,
  onOpenChange,
}: {
  enrollment: GenerateBillTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const freebiesQuery = useEligibleFreebies(enrollment?.enrollmentId);
  const generate = useGenerateBillForEnrollment();

  const voucher = enrollment?.voucher ?? null;
  const gross = enrollment?.feePreview ?? 0;
  const hasVoucher = voucher !== null;

  // Eligibility ignores the voucher, but a promo only applies alongside one — so
  // mirror the server and treat the promos as applied only when a voucher exists.
  const eligibleFreebies = freebiesQuery.data ?? [];
  const appliedFreebies = hasVoucher ? eligibleFreebies : [];
  const hasFreebie = appliedFreebies.length > 0;

  const netAfterVouchers = previewNet(gross, voucher);
  const voucherDiscount = Math.round((gross - netAfterVouchers) * 100) / 100;
  // A freebie zeroes the whole remaining balance.
  const net = hasFreebie ? 0 : netAfterVouchers;

  async function handleGenerate() {
    if (!enrollment) return;
    try {
      await generate.mutateAsync({ enrollmentId: enrollment.enrollmentId });
      onOpenChange(false);
    } catch {
      // Surfaced via generate.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate bill</DialogTitle>
          <DialogDescription>
            {enrollment
              ? `${enrollment.name}'s voucher and any promo they qualify for are applied automatically. Review the total, then generate the bill.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Voucher — granted by the admin on acceptance, shown for confirmation
              only. It is applied automatically when the bill is generated. */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TicketPercentIcon className="text-muted-foreground size-4" />
              <p className="text-sm font-medium">Voucher</p>
            </div>
            {voucher ? (
              <CreditRow title={voucher.name} meta={voucherValueLabel(voucher)} />
            ) : (
              <EmptyHint icon={InfoIcon}>
                No voucher was granted for this enrollment — it is set when the
                application is accepted.
              </EmptyHint>
            )}
          </div>

          {/* Freebies — eligible promos, only with a voucher */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GiftIcon className="text-muted-foreground size-4" />
              <p className="text-sm font-medium">Freebies</p>
            </div>
            {!hasVoucher ? (
              <EmptyHint icon={LockIcon}>
                Freebies only apply to a student who was granted a voucher.
              </EmptyHint>
            ) : freebiesQuery.isLoading ? (
              <Skeleton className="h-14 w-full rounded-lg" />
            ) : eligibleFreebies.length === 0 ? (
              <EmptyHint icon={InfoIcon}>
                This student isn't eligible for any freebies.
              </EmptyHint>
            ) : (
              <div className="space-y-2">
                {appliedFreebies.map((freebie) => (
                  <CreditRow
                    key={freebie.id}
                    title={freebie.name}
                    meta="Zero balance"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-muted/40 space-y-2.5 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fees</span>
              <span className="font-medium tabular-nums">
                {formatPeso(gross)}
              </span>
            </div>
            {voucherDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Voucher discount</span>
                <span className="text-primary font-medium tabular-nums">
                  −{formatPeso(voucherDiscount)}
                </span>
              </div>
            )}
            {hasFreebie && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Freebie</span>
                <span className="text-primary font-medium">Full coverage</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-2.5">
              <span className="text-sm font-medium">Net payable</span>
              {net <= 0 ? (
                <span className="flex items-center gap-2">
                  <span className="text-lg font-semibold tabular-nums">₱0</span>
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    Fully covered
                  </span>
                </span>
              ) : (
                <span className="text-lg font-semibold tabular-nums">
                  {formatPeso(net)}
                </span>
              )}
            </div>
            {hasVoucher && (
              <p className="text-muted-foreground flex items-start gap-1.5 border-t pt-2.5 text-xs">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                A voucher waives the downpayment — the balance is spread across
                monthly installments.
              </p>
            )}
          </div>

          {generate.isError && (
            <p className="text-destructive text-sm">
              {getErrorMessage(generate.error)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generate.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending ? "Generating…" : "Generate bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
