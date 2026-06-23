import { useMemo, useState } from "react";
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
  noDownpayment: boolean;
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
  const [waive, setWaive] = useState(enrollment?.noDownpayment ?? false);

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
  // A freebie zeroes the whole remaining balance.
  const net = hasFreebie ? 0 : previewNet(gross, selected);
  const effectiveWaive = waive || hasVoucher;

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
          noDownpayment: waive,
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
              ? `${enrollment.name} — apply a voucher and any eligible freebie, then generate the bill.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
            <span className="text-muted-foreground">Fees</span>
            <span className="font-medium">{formatPeso(gross)}</span>
          </div>

          {/* Vouchers */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Voucher</p>
            {isLoading ? (
              <Skeleton className="h-20 w-full rounded-md" />
            ) : vouchers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No vouchers in the catalog. Add one under Vouchers first.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1">
                {vouchers.map((d) => (
                  <label
                    key={d.id}
                    className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={() => toggleVoucher(d.id)}
                    />
                    <span className="flex-1 text-sm">{d.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {discountValueLabel(d)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Freebies — eligible promos, only with a voucher */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Freebies</p>
            {!hasVoucher ? (
              <p className="text-muted-foreground text-sm">
                Select a voucher to see the freebies this student qualifies for.
              </p>
            ) : freebiesQuery.isLoading ? (
              <Skeleton className="h-12 w-full rounded-md" />
            ) : eligibleFreebies.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This student isn't eligible for any freebies.
              </p>
            ) : (
              <div className="space-y-1 rounded-lg border p-1">
                {eligibleFreebies.map((f) => (
                  <label
                    key={f.id}
                    className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selectedFreebieIds.has(f.id)}
                      onCheckedChange={() => toggleFreebie(f.id)}
                    />
                    <span className="flex-1 text-sm">{f.name}</span>
                    <span className="text-muted-foreground text-xs">
                      Zero balance
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={effectiveWaive}
              disabled={hasVoucher}
              onCheckedChange={(checked) => setWaive(checked === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Waive downpayment</span>
              <span className="text-muted-foreground block text-xs">
                {hasVoucher
                  ? "A voucher automatically waives the downpayment."
                  : "No downpayment; the balance is spread across monthly installments."}
              </span>
            </span>
          </label>

          <div className="bg-muted/40 flex items-center justify-between rounded-lg px-4 py-3">
            <span className="text-sm font-medium">Net payable</span>
            <span className="text-lg font-semibold">
              {net <= 0 ? "₱0 — fully covered" : formatPeso(net)}
            </span>
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
