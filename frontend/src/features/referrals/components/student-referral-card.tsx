import { formatDate } from "@/features/applications/utils";
import { bannerStyles } from "@/components/ui/banner";
import { useId, useState } from "react";
import { ArrowRightIcon, CheckIcon, CircleCheckIcon, Clock3Icon, CopyIcon, LoaderCircleIcon, UsersRoundIcon, XIcon } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getErrorMessage } from "@/lib/get-error-message";
import { useCreateMyReferralCode, useMyReferrals } from "@/features/referrals/hooks";
import { referralStatusClassName, referralStatusLabel, type MyReferralSummary } from "@/features/referrals/types";

const BENEFIT_DETAILS: Record<string, { label: string; description: string }> = {
  not_earned: {
    label: "No enrolled referral yet",
    description: "Your referral requirement is met once a referred Grade 11 student becomes officially enrolled.",
  },
  expired: {
    label: "Referral cutoff passed",
    description: "No referral qualified by the cutoff. Your Grade 12 bill is now payable without the referral benefit. Later enrollment cannot earn this benefit.",
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
    : summary.ineligibilityReason
      ? { kind: "payment_started", title: "Referral participation is unavailable", reason: summary.ineligibilityReason }
    : summary.enrollmentCutoffPassed
      ? { kind: "expired", title: "Referral enrollment has closed", reason: "New codes and claims are closed. Benefits earned before the cutoff are kept." }
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
            {unavailableReason ? (compact && campaignEnabled && targetSchoolYear && !summary.eligibleToRefer && !summary.code ? "View requirements" : "View referral") : canShareCode ? "View referrals" : canCreateCode ? "Start referring" : "View referral"}
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
  const benefitApplied = benefitStatus === "applied" || benefitStatus === "applied_no_balance";
  const eligibilityId = useId();
  const codeHelpId = useId();
  const createErrorId = useId();
  const progressId = useId();
  const showProgress = !requirementsOnly && Boolean(summary.code?.code || hasProgress);

  return <>
    <SheetHeader className="shrink-0 border-b p-5 pr-16 sm:px-6 sm:pr-16">
      <SheetTitle className="text-lg font-semibold">{requirementsOnly ? "Referral requirements" : "Referral tuition incentive"}</SheetTitle>
      <SheetDescription>
        {targetSchoolYear ? `School year ${targetSchoolYear.schoolYear}` : "Eligibility and Grade 12 benefit conditions."}
      </SheetDescription>
    </SheetHeader>
    <SheetClose asChild>
      <Button variant="ghost" size="icon" className="absolute top-3 right-3 size-11" aria-label="Close referral details">
        <XIcon aria-hidden="true" />
      </Button>
    </SheetClose>
    <div role="region" aria-label="Referral overview" tabIndex={0} className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 text-sm leading-relaxed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-6">
      {unavailable && <section aria-labelledby={eligibilityId} className="space-y-2">
        <h3 id={eligibilityId} className="text-base font-semibold">{unavailable.title}</h3>
        <p>{unavailable.reason}</p>
        {unavailable.kind === "not_eligible" &&
          <p className="text-muted-foreground">If your enrollment history looks incorrect, contact Northlink to have it checked.</p>}
      </section>}

      {summary.enrollmentCutoff && <section aria-label="Referral enrollment cutoff" className="space-y-1">
        <h3 className="font-semibold">Enrollment cutoff · {formatDate(summary.enrollmentCutoff)}</h3>
        <p className="text-muted-foreground">A referred Grade 11 student must complete enrollment by 11:59 PM Philippine time on this date to earn your Grade 12 benefit.</p>
      </section>}

      {(summary.code?.code || canCreateCode) && <section aria-label="Your referral code" className="bg-muted/30 space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">Your referral code</h3>
        {summary.code?.code ? <>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <code className="text-primary dark:text-foreground min-w-0 select-all break-all font-mono text-lg font-semibold tracking-wide">{summary.code.code}</code>
            {canShareCode && <Button variant="outline" className="min-h-11 shrink-0 bg-background" onClick={onCopy} aria-describedby={codeHelpId}>
              {copyState === "copied" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
              {copyState === "copied" ? "Copied" : "Copy code"}
            </Button>}
          </div>
          <p id={codeHelpId} className="text-muted-foreground">{canShareCode
            ? "Share with new or transferee Grade 11 applicants."
            : "Your existing code is kept for reference. It cannot be shared while referrals are unavailable."}</p>
          {canShareCode && <div role="status" aria-live="polite" className={copyState === "idle" ? "sr-only" : undefined}>
            {copyState === "copied" && "Code copied. Ready to share."}
            {copyState === "error" && <p className="text-destructive">Couldn't copy automatically. Select the code above and copy it manually.</p>}
          </div>}
        </> : <>
          <p className="text-muted-foreground">Create your code before making any Grade 12 payment. Creating it reserves your benefit and pauses collection on your voucher-backed Grade 12 bill until you qualify or the enrollment cutoff passes. Do not send a payment during this hold.</p>
          <Button className="min-h-11" onClick={onCreate} disabled={creating} aria-describedby={createError ? createErrorId : undefined}>
            {creating && <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {creating ? "Creating code…" : "Create referral code"}
          </Button>
          {createError && <p id={createErrorId} role="alert" className="text-destructive">{createError}</p>}
        </>}
      </section>}

      {showProgress && <section aria-labelledby={progressId} className="space-y-5">
        <h3 id={progressId} className="text-base font-semibold">Your progress</h3>
        {hasProgress && <section aria-label="Grade 12 benefit" className="flex items-start gap-3">
          {benefitApplied
            ? <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            : <Clock3Icon aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />}
          <div className="min-w-0 space-y-2">
            <h4 className="wrap-anywhere font-medium">{benefit?.label ?? referralStatusLabel(benefitStatus)}</h4>
            <p className="text-muted-foreground">{benefit?.description ?? "Contact Northlink if you need help understanding your benefit status."}</p>
            {successfulCount > 0 && <p className="font-medium tabular-nums">{successfulCount} enrolled {successfulCount === 1 ? "referral" : "referrals"}</p>}
          </div>
        </section>}

        <section aria-label="Referral progress" className={hasProgress ? "space-y-2 border-t pt-4" : "space-y-2"}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium">Referred applicants</h4>
            {referrals.length > 0 && <span className="text-muted-foreground tabular-nums">{referrals.length} {referrals.length === 1 ? "applicant" : "applicants"}</span>}
          </div>
          {referrals.length ? <ul className="divide-y">
            {referrals.map(referral => <li key={referral.id} className="flex flex-col items-start gap-2 py-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between min-[400px]:gap-4">
              <span className="min-w-0 wrap-anywhere">{referral.referredDisplay ?? "Applicant"}</span>
              <Badge variant="outline" className={referralStatusClassName(referral.status) + " h-auto max-w-full whitespace-normal text-left text-sm wrap-anywhere min-[400px]:max-w-3/5"}>{referralStatusLabel(referral.status)}</Badge>
            </li>)}
          </ul> : <p className="text-muted-foreground">{canShareCode
            ? "No applications linked yet. Applicants appear here after submitting an application with your code."
            : "No linked applications to display."}</p>}
        </section>
      </section>}

      <StudentReferralRequirements defaultOpen={requirementsOnly} />
    </div>
  </>;
}

export function StudentReferralRequirements({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return <Accordion type="single" collapsible defaultValue={defaultOpen ? "requirements" : undefined} className="border-t">
    <AccordionItem value="requirements">
      <AccordionTrigger className="py-4">
        <span className="space-y-1">
          <span className="block font-semibold">How referrals work</span>
          <span className="text-muted-foreground block font-normal">Eligibility, vouchers, and benefit coverage</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-5 pb-0 leading-relaxed">
        <section aria-label="Code eligibility" className="space-y-2">
          <h4 className="font-medium">Who can create a code</h4>
          <p className="text-muted-foreground">To create a referral code, you must have been enrolled in Grade 11 in the previous school year.</p>
        </section>
        <section aria-label="Sharing your code" className="space-y-2">
          <h4 className="font-medium">Sharing your code</h4>
          <p className="text-muted-foreground">New or transferee Grade 11 applicants enter your code before submitting their application. You can share the same code with more than one applicant.</p>
        </section>
        <section aria-label="Grade 12 benefit requirements" className="space-y-3">
          <h4 className="font-medium">Grade 12 benefit requirements</h4>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5">
            <li>At least one referred Grade 11 student must become officially enrolled.</li>
            <li>You need an active voucher for your own Grade 12 enrollment.</li>
          </ul>
          <p>The benefit covers your remaining unpaid Grade 12 bill, including miscellaneous fees, after your voucher.</p>
          <p className="text-muted-foreground">Payments made before this benefit is applied are not refunded or carried forward.</p>
          <p className="text-muted-foreground">Creating a code reserves your Grade 12 benefit until a referral qualifies or the school’s enrollment cutoff passes. Rejected or withdrawn applicants can be replaced before that date. If none qualify by the cutoff, your bill becomes payable without the referral benefit.</p>
        </section>
        <section aria-label="Benefits for each student" className="space-y-3">
          <h4 className="font-medium">Benefits for each student</h4>
          <ul className="text-muted-foreground list-disc space-y-3 pl-5">
            <li>The referred Grade 11 applicant qualifies at application acceptance. Your referral requirement is met when that student becomes officially enrolled.</li>
            <li>Each student needs their own active voucher. A missing voucher for one student does not block the other student’s benefit.</li>
            <li>Your Grade 12 benefit is awarded once per school year. Additional applicants can still qualify for their own benefit.</li>
          </ul>
        </section>
      </AccordionContent>
    </AccordionItem>
  </Accordion>;
}
