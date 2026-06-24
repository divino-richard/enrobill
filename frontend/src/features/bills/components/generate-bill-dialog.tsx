import { useMemo, useState } from "react";
import { GiftIcon, InfoIcon, LockIcon, TicketPercentIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { useAllDiscounts } from "@/features/discounts/hooks";
import { discountValueLabel, type Discount } from "@/features/discounts/types";
import { useEligibleFreebies } from "@/features/freebies/hooks";
import { useGenerateBillForEnrollment } from "@/features/bills/hooks";

// The minimal data the dialog needs about the enrollment being billed.
export interface GenerateBillTarget {
  enrollmentId: number;
  name: string;
  feePreview: number;
}

// Mirror the backend voucher math (Bill::creditFor): each credit caps at the
// remaining balance.
function previewNet(gross: number, selected: Discount[]): number {
  let remaining = gross;
  for (const d of selected) {
    const nominal =
      d.type === "percentage" ? (gross * d.value) / 100 : d.value;
    remaining = Math.round((remaining - Math.min(nominal, remaining)) * 100) / 100;
  }
  return Math.max(remaining, 0);
}

// A single selectable voucher/freebie row.
function OptionRow({
  checked,
  onToggle,
  title,
  meta,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  meta: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="flex-1 font-medium">{title}</span>
      <span
        className={cn(
          "text-xs font-medium",
          checked ? "text-primary" : "text-muted-foreground",
        )}
      >
        {meta}
      </span>
    </label>
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
  const { data: discounts, isLoading } = useAllDiscounts();
  const freebiesQuery = useEligibleFreebies(enrollment?.enrollmentId);
  const generate = useGenerateBillForEnrollment();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedFreebieIds, setSelectedFreebieIds] = useState<Set<number>>(
    new Set(),
  );

  const vouchers = useMemo(
    () => (discounts ?? []).filter((d) => d.isActive),
    [discounts],
  );
  const selected = useMemo(
    () => vouchers.filter((d) => selectedIds.has(d.id)),
    [vouchers, selectedIds],
  );
  const eligibleFreebies = freebiesQuery.data ?? [];

  const gross = enrollment?.feePreview ?? 0;
  const hasVoucher = selected.length > 0;
  const hasFreebie = selectedFreebieIds.size > 0;
  const netAfterVouchers = previewNet(gross, selected);
  const voucherDiscount = Math.round((gross - netAfterVouchers) * 100) / 100;
  // A freebie zeroes the whole remaining balance.
  const net = hasFreebie ? 0 : netAfterVouchers;

  function toggleVoucher(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Freebies require a voucher — drop them if no voucher remains.
      if (next.size === 0) setSelectedFreebieIds(new Set());
      return next;
    });
  }

  function toggleFreebie(id: number) {
    setSelectedFreebieIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    if (!enrollment) return;
    try {
      await generate.mutateAsync({
        enrollmentId: enrollment.enrollmentId,
        input: {
          discountIds: [...selectedIds],
          freebieIds: [...selectedFreebieIds],
        },
      });
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
              ? `Apply a voucher and any eligible freebie for ${enrollment.name}, then generate the bill.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Vouchers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TicketPercentIcon className="text-muted-foreground size-4" />
              <p className="text-sm font-medium">Voucher</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-14 w-full rounded-lg" />
            ) : vouchers.length === 0 ? (
              <EmptyHint icon={InfoIcon}>
                No vouchers in the catalog. Add one under Vouchers first.
              </EmptyHint>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto pr-0.5">
                {vouchers.map((d) => (
                  <OptionRow
                    key={d.id}
                    checked={selectedIds.has(d.id)}
                    onToggle={() => toggleVoucher(d.id)}
                    title={d.name}
                    meta={discountValueLabel(d)}
                  />
                ))}
              </div>
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
                Select a voucher to see the freebies this student qualifies for.
              </EmptyHint>
            ) : freebiesQuery.isLoading ? (
              <Skeleton className="h-14 w-full rounded-lg" />
            ) : eligibleFreebies.length === 0 ? (
              <EmptyHint icon={InfoIcon}>
                This student isn't eligible for any freebies.
              </EmptyHint>
            ) : (
              <div className="space-y-2">
                {eligibleFreebies.map((f) => (
                  <OptionRow
                    key={f.id}
                    checked={selectedFreebieIds.has(f.id)}
                    onToggle={() => toggleFreebie(f.id)}
                    title={f.name}
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
