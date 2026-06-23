import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  categoryLabel,
  discountValueLabel,
  type Discount,
} from "@/features/discounts/types";
import { useGenerateBillForEnrollment } from "@/features/bills/hooks";

// The minimal data the dialog needs about the enrollment being billed.
export interface GenerateBillTarget {
  enrollmentId: number;
  name: string;
  feePreview: number;
  noDownpayment: boolean;
}

// Mirror the backend credit math for a live preview: fixed/percentage resolve
// against the gross (capped); any full-coverage credit zeroes the remainder.
function previewNet(gross: number, selected: Discount[]): number {
  const hasFull = selected.some((d) => d.type === "full");
  if (hasFull) return 0;
  const credits = selected.reduce((sum, d) => {
    const credit =
      d.type === "percentage"
        ? Math.min((gross * d.value) / 100, gross)
        : Math.min(d.value, gross);
    return sum + credit;
  }, 0);
  return Math.max(Math.round((gross - credits) * 100) / 100, 0);
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
  const generate = useGenerateBillForEnrollment();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [waive, setWaive] = useState(enrollment?.noDownpayment ?? false);

  const active = useMemo(
    () => (discounts ?? []).filter((d) => d.isActive),
    [discounts],
  );
  const selected = useMemo(
    () => active.filter((d) => selectedIds.has(d.id)),
    [active, selectedIds],
  );

  const gross = enrollment?.feePreview ?? 0;
  const net = previewNet(gross, selected);
  const hasVoucher = selected.some((d) => d.category === "voucher");
  // A voucher always waives the downpayment.
  const effectiveWaive = waive || hasVoucher;

  function toggle(id: number) {
    setSelectedIds((prev) => {
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
        input: { discountIds: [...selectedIds], noDownpayment: waive },
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
              ? `${enrollment.name} — apply any voucher, discounts or freebie, then generate the bill.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
            <span className="text-muted-foreground">Fees</span>
            <span className="font-medium">{formatPeso(gross)}</span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Credits</p>
            {isLoading ? (
              <Skeleton className="h-24 w-full rounded-md" />
            ) : active.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No discounts in the catalog. Add vouchers/discounts under
                Discounts first.
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
                {active.map((d) => (
                  <label
                    key={d.id}
                    className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={() => toggle(d.id)}
                    />
                    <span className="flex-1 text-sm">{d.name}</span>
                    <Badge variant="outline" className="font-normal">
                      {categoryLabel(d.category)}
                    </Badge>
                    <span className="text-muted-foreground w-28 text-right text-xs">
                      {discountValueLabel(d)}
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
