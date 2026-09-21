import { bannerStyles } from "@/components/ui/banner";
import { useState } from "react";
import { ArrowRightIcon, CheckIcon, CopyIcon, LoaderCircleIcon, UsersRoundIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { useCreateMyReferralCode, useMyReferrals } from "@/features/referrals/hooks";
import { referralStatusClassName, referralStatusLabel } from "@/features/referrals/types";

const BENEFIT_DETAILS: Record<string, { label: string; description: string }> = {
  not_earned: {
    label: "Waiting for a student to enroll",
    description: "One referred Grade 11 student must become officially enrolled to unlock your Grade 12 benefit.",
  },
  pending: {
    label: "Waiting for Grade 12 enrollment",
    description: "Your referral requirement is met. Your benefit can be evaluated once your Grade 12 enrollment is available.",
  },
  eligible: {
    label: "Waiting for voucher and billing checks",
    description: "Your referral requirement is met. An active voucher on your own Grade 12 enrollment and a bill are required before credit can be applied.",
  },
  applied: {
    label: "Tuition benefit applied",
    description: "Your remaining unpaid bill was waived after your voucher. See your bill for the credit amount.",
  },
  applied_no_balance: {
    label: "Qualified · no unpaid balance",
    description: "Your bill was already covered, so no additional credit was needed. Previous payments are not refunded or carried forward.",
  },
};

export function StudentReferralCard({ showWhenUnavailable = false }: { showWhenUnavailable?: boolean }) {
  const summaryQuery = useMyReferrals();
  const createCode = useCreateMyReferralCode();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  if (summaryQuery.isLoading) {
    return <div role="status" aria-label="Loading referrals"><Skeleton className="h-24 w-full rounded-lg sm:h-20" /></div>;
  }
  if (summaryQuery.isError) {
    return (
      <section aria-label="Referral tuition incentive" className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <div><p className="font-medium">Refer a Grade 11 student</p><p className="text-muted-foreground text-sm" role="alert">We couldn't load your referral progress.</p></div>
        <Button variant="outline" size="sm" disabled={summaryQuery.isFetching} onClick={() => summaryQuery.refetch()}>{summaryQuery.isFetching ? "Retrying…" : "Try again"}</Button>
      </section>
    );
  }

  const summary = summaryQuery.data;
  if (!summary || (!summary.eligibleToRefer && !summary.code && !showWhenUnavailable)) return null;
  const targetSchoolYear = summary.code?.targetSchoolYear ?? summary.targetSchoolYear;
  const referrals = summary.referrals ?? [];
  const successfulCount = summary.successfulCount ?? 0;
  const campaignEnabled = summary.campaignEnabled ?? true;
  const canCreateCode = Boolean(campaignEnabled && summary.eligibleToRefer && targetSchoolYear);
  const canShareCode = Boolean(campaignEnabled && summary.code?.code && summary.code.isActive !== false);
  const benefitStatus = summary.benefitStatus ?? (successfulCount > 0 ? "pending" : "not_earned");
  const benefit = BENEFIT_DETAILS[benefitStatus];
  const unavailableReason = !targetSchoolYear
    ? "Codes will be available when Northlink sets up the upcoming school year."
    : !campaignEnabled
      ? "The referral campaign is paused. Existing progress and applied benefits are kept."
      : summary.code?.isActive === false
        ? "This code is inactive. Contact Northlink before sharing it."
        : !summary.eligibleToRefer && !summary.code
          ? "You need an enrolled Grade 11 record in the immediately preceding school year to create a code."
          : null;

  async function copyCode() {
    if (!summary?.code?.code) return;
    try {
      await navigator.clipboard.writeText(summary.code.code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }
  async function issueCode() {
    if (!targetSchoolYear) return;
    try { await createCode.mutateAsync(targetSchoolYear.id); } catch { /* Shown inline. */ }
  }

  return (
    <Sheet>
      <section aria-label="Referral tuition incentive" className={bannerStyles({ className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" })}>
        <div className="flex min-w-0 items-start gap-3">
          <UsersRoundIcon aria-hidden="true" className="text-current mt-0.5 size-6 shrink-0" />
          <div className="min-w-0 space-y-1">
            <h2 className="text-current text-base font-semibold">
              {unavailableReason ? "Referral tuition incentive" : "Invite a student. Unlock your tuition benefit."}
            </h2>
            <p className="text-current text-sm leading-relaxed">
              {unavailableReason ?? "Refer a Grade 11 applicant. You may both qualify for free tuition with your own vouchers."}
            </p>
          </div>
        </div>
        <SheetTrigger asChild>
          <Button
            variant={unavailableReason ? "outline" : "default"}
            size="sm"
            className={unavailableReason
              ? "self-start sm:self-auto"
              : "self-start motion-reduce:transition-none sm:self-auto"}
          >
            {unavailableReason ? "View referral" : canShareCode ? "Share your code" : canCreateCode ? "Start referring" : "View referral"}
            <ArrowRightIcon aria-hidden="true" className="motion-safe:transition-transform motion-safe:group-hover/button:translate-x-0.5" />
          </Button>
        </SheetTrigger>
      </section>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b p-5 pr-14">
          <SheetTitle>Referral tuition incentive</SheetTitle>
          <SheetDescription>
            {targetSchoolYear ? `SY ${targetSchoolYear.schoolYear} · ` : ""}
            Your code, referral progress, and Grade 12 benefit.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          <div className="space-y-5">
            <div className="min-w-0 space-y-3">
              <h3 className="text-sm font-medium">Your referral code</h3>
              {summary.code?.code ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="text-primary dark:text-foreground min-w-0 select-all break-all font-mono text-lg font-semibold tracking-wide sm:text-xl">{summary.code.code}</code>
                    <Button variant="outline" size="sm" onClick={copyCode} disabled={!canShareCode}>
                      {copyState === "copied" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                      {copyState === "copied" ? "Copied" : "Copy code"}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">Share this code with new or transferee Grade 11 applicants. They enter it before submitting their application. The same code can be used by more than one applicant.</p>
                  <div role="status" aria-live="polite" className="text-xs">
                    {copyState === "copied" && "Code copied. Ready to share."}
                    {copyState === "error" && <span className="text-destructive">Couldn't copy automatically. Select the code above and copy it manually.</span>}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">Create a code for applicants to enter on their Northlink application.</p>
                  <Button onClick={issueCode} disabled={!canCreateCode || createCode.isPending}>
                    {createCode.isPending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
                    {createCode.isPending ? "Creating code…" : "Create referral code"}
                  </Button>
                </>
              )}
              {unavailableReason && <p className="text-muted-foreground border-l pl-3 text-xs leading-relaxed">{unavailableReason}</p>}
              {createCode.isError && <p role="alert" className="text-destructive text-sm">{getErrorMessage(createCode.error, "We couldn't create your code. Please try again.")}</p>}
            </div>

            <div className="space-y-2 border-t pt-5">
              <h3 className="text-sm font-medium">Your Grade 12 tuition benefit</h3>
              <Badge variant="outline" className={referralStatusClassName(benefitStatus) + " h-auto whitespace-normal text-left"}>
                {benefit?.label ?? referralStatusLabel(benefitStatus)}
              </Badge>
              <p className="text-muted-foreground text-xs leading-relaxed">{benefit?.description ?? "Contact Northlink if you need help understanding your benefit status."}</p>
              <p className="text-sm"><span className="font-semibold tabular-nums">{successfulCount}</span> {successfulCount === 1 ? "successful referral" : "successful referrals"}<span className="text-muted-foreground"> · Only one is required</span></p>
            </div>
          </div>

          <section className="border-t pt-4" aria-label="Referral progress">
            <h3 className="text-sm font-medium">Referral progress</h3>
            <p className="text-muted-foreground mt-1 text-xs">Code submitted → Application accepted → Student enrolled</p>
            {referrals.length ? (
              <ul className="mt-2 divide-y">
                {referrals.map((referral) => (
                  <li key={referral.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0 break-words text-sm">{referral.referredDisplay ?? "Applicant"}</span>
                    <Badge variant="outline" className={referralStatusClassName(referral.status)}>{referralStatusLabel(referral.status)}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground mt-3 text-sm">No applications linked yet. Applicants appear here after submitting your code.</p>}
          </section>

          <details className="border-t pt-4 text-xs">
            <summary className="focus-visible:outline-ring cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4">How the tuition benefit works</summary>
            <ul className="text-muted-foreground mt-3 list-disc space-y-2 pl-4 leading-relaxed">
              <li>The Grade 11 applicant qualifies at application acceptance. You qualify when that student becomes officially enrolled.</li>
              <li>Each benefit needs that student's own active voucher. A missing voucher on one side does not block the other.</li>
              <li>The benefit waives the remaining unpaid bill, including miscellaneous fees, after the voucher. Previous payments are not refunded or carried forward.</li>
              <li>Your Grade 12 benefit is awarded once per school year. Additional applicants can still qualify for their own benefit.</li>
            </ul>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
}
