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
import { useEnrollmentIncentives } from "@/features/referrals/hooks";
import { referralStatusLabel } from "@/features/referrals/types";
import { previewNet } from "@/features/bills/incentive-preview";

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

// A credit that will be applied to the bill. Both kinds are derived rather than
// chosen, so the row is a statement of fact, not a control.
function CreditRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
      <LockIcon className="text-muted-foreground size-4 shrink-0" />
      <span className="flex-1 font-medium">{title}</span>
      <span className="text-primary dark:text-foreground text-xs font-medium">{meta}</span>
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

function incentiveRoleLabel(role?: string | null): string {
  switch (role) {
    case "early_grade_11":
      return "Early Grade 11 enrollment";
    case "referred_grade_11":
      return "Referred Grade 11 student";
    case "referrer_grade_12":
      return "Grade 12 referrer";
    default:
      return role?.replaceAll("_", " ") ?? "Tuition incentive";
  }
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
  const incentivesQuery = useEnrollmentIncentives(enrollment?.enrollmentId);
  const generate = useGenerateBillForEnrollment();

  const voucher = enrollment?.voucher ?? null;
  const gross = enrollment?.feePreview ?? 0;
  const hasVoucher = incentivesQuery.data?.hasVoucher === true && voucher !== null;

  // Eligibility ignores the voucher, but a promo only applies alongside one — so
  // mirror the server and treat the promos as applied only when a voucher exists.
  const eligibleFreebies = freebiesQuery.data ?? [];
  const incentiveAwards = incentivesQuery.data?.awards ?? [];
  const earnedAwards = incentiveAwards.filter((award) =>
    ["eligible", "applied", "applied_no_balance"].includes(award.status ?? ""),
  );
  const hasFreebie = hasVoucher && (eligibleFreebies.length > 0 || earnedAwards.length > 0);
  const incentiveReasons = incentivesQuery.data?.reasons ?? [];
  const awardReasons = new Set(
    incentiveAwards
      .map((award) => award.reason)
      .filter((reason): reason is string => Boolean(reason)),
  );
  const additionalIncentiveReasons = incentiveReasons.filter(
    (reason) => !awardReasons.has(reason),
  );
  const checkingIncentives =
    freebiesQuery.isLoading || incentivesQuery.isLoading;
  const incentiveCheckFailed =
    freebiesQuery.isError || incentivesQuery.isError;

  const netAfterVouchers = previewNet(gross, hasVoucher ? voucher : null);
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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
              <CreditRow title={voucher.name} meta={checkingIncentives ? "Checking…" : incentiveCheckFailed ? "Not verified" : hasVoucher ? voucherValueLabel(voucher) : "Inactive · not applied"} />
            ) : (
              <EmptyHint icon={InfoIcon}>
                No voucher was granted for this enrollment — it is set when the
                application is accepted.
              </EmptyHint>
            )}
          </div>

          <section className="space-y-3" aria-label="Tuition incentive">
            <div className="flex items-center gap-2">
              <GiftIcon className="text-muted-foreground size-4" aria-hidden="true" />
              <h3 className="text-sm font-medium">Tuition incentive</h3>
            </div>
            {checkingIncentives ? (
              <div role="status" aria-label="Checking tuition incentives"><Skeleton className="h-16 w-full rounded-lg" /></div>
            ) : incentiveCheckFailed ? (
              <div role="alert" className="border-destructive/30 rounded-lg border p-3 text-sm">
                <p>We couldn't verify the voucher and tuition incentives.</p>
                <Button className="mt-2" variant="outline" size="sm" disabled={freebiesQuery.isFetching || incentivesQuery.isFetching}
                  onClick={() => { void freebiesQuery.refetch(); void incentivesQuery.refetch(); }}>Try again</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {incentiveAwards.map((award) => (
                  <div key={award.id} className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{award.freebie?.name ?? incentiveRoleLabel(award.role)}</p>
                      <span className="text-muted-foreground">{referralStatusLabel(award.status)}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{award.reason ?? incentiveRoleLabel(award.role)}</p>
                  </div>
                ))}
                {eligibleFreebies.filter((freebie) => !incentiveAwards.some((award) => award.freebie?.id === freebie.id)).map((freebie) => (
                  <div key={freebie.id} className="text-sm">
                    <p className="font-medium">{freebie.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{hasVoucher ? "Qualifies for the remaining-balance waiver." : "Qualifies, but an active voucher is required before credit can apply."}</p>
                  </div>
                ))}
                {additionalIncentiveReasons.length > 0 && (
                  <ul className="text-muted-foreground space-y-2 text-xs leading-relaxed">
                    {additionalIncentiveReasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                )}
                {hasFreebie && <p className="text-muted-foreground border-l-2 border-primary/40 pl-3 text-xs leading-relaxed">All qualifying reasons share one credit. After the voucher, the remaining bill, including miscellaneous fees, is waived once.</p>}
                {!incentiveAwards.length && !eligibleFreebies.length && !incentiveReasons.length && <p className="text-muted-foreground text-sm">No tuition incentive is recorded for this enrollment.</p>}
              </div>
            )}
          </section>

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
                <span className="text-primary dark:text-foreground font-medium tabular-nums">
                  −{formatPeso(voucherDiscount)}
                </span>
              </div>
            )}
            {hasFreebie && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tuition incentive · one credit</span>
                <span className="text-primary dark:text-foreground font-medium tabular-nums">−{formatPeso(netAfterVouchers)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-2.5">
              <span className="text-sm font-medium">Net payable</span>
              {checkingIncentives || incentiveCheckFailed ? (
                <span className="text-muted-foreground text-sm">{incentiveCheckFailed ? "Unable to verify" : "Checking…"}</span>
              ) : net <= 0 ? (
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
            {hasVoucher && net > 0 && !checkingIncentives && !incentiveCheckFailed && (
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
          <Button
            onClick={handleGenerate}
            disabled={
              generate.isPending || checkingIncentives || incentiveCheckFailed
            }
          >
            {generate.isPending ? "Generating…" : "Generate bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
