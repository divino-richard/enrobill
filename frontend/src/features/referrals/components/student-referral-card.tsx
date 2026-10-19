import { bannerStyles } from "@/components/ui/banner";
import { useId, useState } from "react";
import { ArrowRightIcon, CheckIcon, CopyIcon, LoaderCircleIcon, UsersRoundIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { useCreateMyReferralCode, useMyReferrals } from "@/features/referrals/hooks";
import { referralStatusClassName, referralStatusLabel, type MyReferralSummary } from "@/features/referrals/types";

const BENEFIT_DETAILS: Record<string, { label: string; description: string }> = {
  not_earned: {
    label: "No enrolled referral yet",
    description: "Your referral requirement is met once a referred Grade 11 student becomes officially enrolled.",
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

function referralView(summary: MyReferralSummary) {
  const targetSchoolYear = summary.code?.targetSchoolYear ?? summary.targetSchoolYear;
  const referrals = summary.referrals ?? [];
  const successfulCount = summary.successfulCount ?? 0;
  const campaignEnabled = summary.campaignEnabled ?? true;
  const canCreateCode = Boolean(campaignEnabled && summary.eligibleToRefer && targetSchoolYear && summary.code?.isActive !== false);
  const canShareCode = Boolean(campaignEnabled && summary.code?.code && summary.code.isActive !== false);
  const benefitStatus = summary.benefitStatus ?? (successfulCount > 0 ? "pending" : "not_earned");
  const unavailable = !targetSchoolYear
    ? { kind: "no_year", title: "Referral codes are not available yet", reason: "Codes will be available when Northlink sets up the upcoming school year." }
    : !campaignEnabled
      ? { kind: "paused", title: "Referrals are paused", reason: "The referral campaign is paused. Existing progress and applied benefits are kept." }
      : summary.code?.isActive === false
        ? { kind: "inactive", title: "Your referral code is inactive", reason: "This code is inactive. Contact Northlink before sharing it." }
        : !summary.eligibleToRefer && !summary.code?.code
          ? { kind: "not_eligible", title: "You’re not eligible to create a code", reason: "To create a referral code, you must have been enrolled in Grade 11 in the previous school year." }
          : null;
  const hasProgress = referrals.length > 0 || successfulCount > 0 || benefitStatus !== "not_earned";
  const requirementsOnly = Boolean(unavailable) && !canShareCode && !hasProgress;
  return { targetSchoolYear, referrals, successfulCount, campaignEnabled, canCreateCode, canShareCode, benefitStatus, unavailable, hasProgress, requirementsOnly };
}

export function StudentReferralCard({ showWhenUnavailable = false, compact = false }: { showWhenUnavailable?: boolean; compact?: boolean }) {
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
        <Button variant="outline" className="min-h-11" disabled={summaryQuery.isFetching} onClick={() => summaryQuery.refetch()}>{summaryQuery.isFetching ? "Retrying…" : "Try again"}</Button>
      </section>
    );
  }

  const summary = summaryQuery.data;
  if (!summary) return null;
  const { targetSchoolYear, campaignEnabled, canCreateCode, canShareCode, unavailable, hasProgress, requirementsOnly } = referralView(summary);
  if (!summary.eligibleToRefer && !summary.code && !showWhenUnavailable && !hasProgress) return null;
  const unavailableReason = unavailable?.reason;
  const showRequirementsOnly = compact && requirementsOnly;

  async function copyCode() {
    if (!summary?.code?.code || !canShareCode) return;
    try {
      await navigator.clipboard.writeText(summary.code.code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }
  async function issueCode() {
    if (!targetSchoolYear || !canCreateCode) return;
    try { await createCode.mutateAsync(targetSchoolYear.id); } catch { /* Shown inline. */ }
  }

  return (
    <Sheet>
      {showRequirementsOnly ? (
        <SheetTrigger asChild>
          <Button variant="ghost" className="text-muted-foreground h-auto min-h-11 max-w-full justify-start gap-2 px-3 py-2 whitespace-normal text-left">
            <UsersRoundIcon aria-hidden="true" />
            Referral requirements
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </SheetTrigger>
      ) : (
      <section aria-label="Referral tuition incentive" className={compact
        ? "border-primary/15 bg-primary/5 flex flex-col gap-5 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-6"
        : bannerStyles({ className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" })}>
        <div className="flex min-w-0 items-start gap-4">
          <UsersRoundIcon aria-hidden="true" className={compact ? "text-primary dark:text-foreground mt-0.5 size-6 shrink-0" : "text-current mt-0.5 size-6 shrink-0"} />
          <div className="min-w-0 space-y-1.5">
            <h2 className={compact ? "text-foreground text-base font-semibold" : "text-current text-base font-semibold"}>
              {compact || unavailableReason ? "Referral tuition incentive" : "Invite a student. Unlock your tuition benefit."}
            </h2>
            <p className={compact ? "text-foreground/75 max-w-prose text-sm leading-relaxed" : "text-current text-sm leading-relaxed"}>
              {unavailableReason ?? "Refer a Grade 11 applicant. You may both qualify for free tuition with your own vouchers."}
            </p>
          </div>
        </div>
        <SheetTrigger asChild>
          <Button
            variant={compact || unavailableReason ? "outline" : "default"}
            size="sm"
            className={compact ? "text-primary dark:text-foreground border-primary/20 h-11 w-full gap-2 px-4 shadow-none motion-reduce:transition-none sm:w-auto sm:self-center" : unavailableReason
              ? "self-start sm:self-auto"
              : "self-start motion-reduce:transition-none sm:self-auto"}
          >
            {unavailableReason ? (compact && campaignEnabled && targetSchoolYear && !summary.eligibleToRefer && !summary.code ? "View requirements" : "View referral") : canShareCode ? "Share your code" : canCreateCode ? "Start referring" : "View referral"}
            <ArrowRightIcon aria-hidden="true" className="motion-safe:transition-transform motion-safe:group-hover/button:translate-x-0.5" />
          </Button>
        </SheetTrigger>
      </section>
      )}
      <SheetContent showCloseButton={false} className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <StudentReferralDetails
          summary={summary}
          onCreate={issueCode}
          onCopy={copyCode}
          creating={createCode.isPending}
          copyState={copyState}
          createError={createCode.isError ? getErrorMessage(createCode.error, "We couldn't create your code. Please try again.") : undefined}
        />
      </SheetContent>
    </Sheet>
  );
}


type ReferralDetailsProps = {
  summary: MyReferralSummary;
  onCreate: () => void;
  onCopy: () => void;
  creating?: boolean;
  copyState?: "idle" | "copied" | "error";
  createError?: string;
};

export function StudentReferralDetails({ summary, onCreate, onCopy, creating = false, copyState = "idle", createError }: ReferralDetailsProps) {
  const { targetSchoolYear, referrals, successfulCount, canCreateCode, canShareCode, benefitStatus, unavailable, hasProgress, requirementsOnly } = referralView(summary);
  const benefit = BENEFIT_DETAILS[benefitStatus];
  const eligibilityId = useId();
  const codeHelpId = useId();
  const createErrorId = useId();

  return <>
    <SheetHeader className="shrink-0 border-b p-5 pr-16">
      <SheetTitle className="text-lg font-semibold">{requirementsOnly ? "Referral requirements" : "Referral tuition incentive"}</SheetTitle>
      <SheetDescription>
        {targetSchoolYear ? `SY ${targetSchoolYear.schoolYear} · ` : ""}
        {requirementsOnly ? "Eligibility and Grade 12 benefit conditions." : "Your code, referred applicants, and Grade 12 benefit."}
      </SheetDescription>
    </SheetHeader>
    <SheetClose asChild>
      <Button variant="ghost" size="icon" className="absolute top-3 right-3 size-11" aria-label="Close referral details">
        <XIcon aria-hidden="true" />
      </Button>
    </SheetClose>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 text-sm leading-relaxed">
      {unavailable && <section aria-labelledby={eligibilityId} className="space-y-2">
        <h3 id={eligibilityId} className="text-base font-semibold">{unavailable.title}</h3>
        <p>{unavailable.reason}</p>
        {unavailable.kind === "not_eligible" &&
          <p className="text-muted-foreground">If your enrollment history looks incorrect, contact Northlink to have it checked.</p>}
      </section>}

      {(summary.code?.code || canCreateCode) && <section aria-label="Your referral code" className={unavailable ? "space-y-3 border-t pt-5" : "space-y-3"}>
        <h3 className="text-base font-semibold">Your referral code</h3>
        {summary.code?.code ? <>
          <div className="flex flex-wrap items-center gap-3">
            <code className="text-primary dark:text-foreground min-w-0 select-all break-all font-mono text-lg font-semibold tracking-wide sm:text-xl">{summary.code.code}</code>
            {canShareCode && <Button variant="outline" className="min-h-11" onClick={onCopy} aria-describedby={codeHelpId}>
              {copyState === "copied" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
              {copyState === "copied" ? "Copied" : "Copy code"}
            </Button>}
          </div>
          <p id={codeHelpId} className="text-muted-foreground">{canShareCode
            ? "Share this code with new or transferee Grade 11 applicants. They enter it before submitting their application. You can share the same code with more than one applicant."
            : "Your existing code is kept for reference. It cannot be shared while referrals are unavailable."}</p>
          {canShareCode && <div role="status" aria-live="polite">
            {copyState === "copied" && "Code copied. Ready to share."}
            {copyState === "error" && <p className="text-destructive">Couldn't copy automatically. Select the code above and copy it manually.</p>}
          </div>}
        </> : <>
          <p className="text-muted-foreground">You’re eligible to create a code for Grade 11 applicants to enter on their Northlink application.</p>
          <Button className="min-h-11" onClick={onCreate} disabled={creating} aria-describedby={createError ? createErrorId : undefined}>
            {creating && <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {creating ? "Creating code…" : "Create referral code"}
          </Button>
          {createError && <p id={createErrorId} role="alert" className="text-destructive">{createError}</p>}
        </>}
      </section>}

      <section aria-label="Grade 12 benefit" className="space-y-3 border-t pt-5">
        <h3 className="text-base font-semibold">{hasProgress ? "Your Grade 12 tuition benefit" : "Grade 12 benefit requirements"}</h3>
        {hasProgress && <div className="space-y-2">
          <Badge variant="outline" className={referralStatusClassName(benefitStatus) + " h-auto whitespace-normal text-left text-sm"}>
            {benefit?.label ?? referralStatusLabel(benefitStatus)}
          </Badge>
          <p>{benefit?.description ?? "Contact Northlink if you need help understanding your benefit status."}</p>
          {successfulCount > 0 && <p className="font-medium tabular-nums">{successfulCount} enrolled {successfulCount === 1 ? "referral" : "referrals"}</p>}
        </div>}
        <ul className="list-disc space-y-2 pl-5">
          <li>At least one referred Grade 11 student must become officially enrolled.</li>
          <li>You need an active voucher for your own Grade 12 enrollment.</li>
        </ul>
        <p>The benefit covers your remaining unpaid Grade 12 bill, including miscellaneous fees, after your voucher.</p>
        <p className="text-muted-foreground">Payments made before this benefit is applied are not refunded or carried forward.</p>
      </section>

      {!requirementsOnly && (summary.code?.code || hasProgress) && <section className="space-y-3 border-t pt-5" aria-label="Referral progress">
        <h3 className="text-base font-semibold">Referred applicants</h3>
        {referrals.length ? <>
          <p className="text-muted-foreground">A referral counts toward your benefit when the student is officially enrolled.</p>
          <ul className="divide-y">
            {referrals.map(referral => <li key={referral.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0 wrap-anywhere">{referral.referredDisplay ?? "Applicant"}</span>
              <Badge variant="outline" className={referralStatusClassName(referral.status) + " h-auto whitespace-normal text-left text-sm"}>{referralStatusLabel(referral.status)}</Badge>
            </li>)}
          </ul>
        </> : <p className="text-muted-foreground">{canShareCode
          ? "No applications linked yet. Applicants appear here after submitting an application with your code."
          : "No linked applications to display."}</p>}
      </section>}

      <details className="border-t">
        <summary className="focus-visible:outline-ring min-h-11 cursor-pointer content-center rounded-sm py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-4">More about the tuition benefit</summary>
        <ul className="text-muted-foreground list-disc space-y-3 pt-2 pl-5">
          <li>The referred Grade 11 applicant qualifies at application acceptance. Your referral requirement is met when that student becomes officially enrolled.</li>
          <li>Each student needs their own active voucher. A missing voucher for one student does not block the other student’s benefit.</li>
          <li>Your Grade 12 benefit is awarded once per school year. Additional applicants can still qualify for their own benefit.</li>
        </ul>
      </details>
    </div>
  </>;
}
