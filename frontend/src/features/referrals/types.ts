import type { FreebieType } from "@/features/freebies/types";

// Referral statuses are server-owned so newly introduced lifecycle states can
// still render without requiring a frontend release first.
export type ReferralStatus = string;

export interface ReferralCode {
  id: number;
  code: string | null;
  targetSchoolYear?: {
    id: number;
    schoolYear: string;
  } | null;
  isActive?: boolean;
}

export interface MyReferral {
  id: number;
  referredDisplay?: string | null;
  status?: ReferralStatus | null;
}

export interface MyReferralSummary {
  code?: ReferralCode | null;
  targetSchoolYear?: {
    id: number;
    schoolYear: string;
  } | null;
  eligibleToRefer?: boolean;
  campaignEnabled?: boolean;
  successfulCount?: number;
  benefitStatus?: string | null;
  referrals?: MyReferral[] | null;
}

export interface ReferralCodeValidation {
  valid: true;
  referrerDisplay: string;
}

export interface ApplicationReferralSummary {
  id: number;
  code?: string | null;
  referrerDisplay?: string | null;
  status?: ReferralStatus | null;
}

export interface AdminReferralParty {
  id: number;
  studentNumber?: string | null;
  name?: string | null;
}

export interface AdminReferralApplication {
  id: number;
  reference?: string | null;
  name?: string | null;
}

export interface AdminReferralActor {
  id: number;
  name?: string | null;
}

export interface AdminReferral {
  id: number;
  code?: string | null;
  schoolYearId?: number | null;
  schoolYear?: string | null;
  referrer?: AdminReferralParty | null;
  referredApplication?: AdminReferralApplication | null;
  referredStudent?: AdminReferralParty | null;
  status?: ReferralStatus | null;
  claimedAt?: string | null;
  acceptedAt?: string | null;
  successfulAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  claimedBy?: AdminReferralActor | null;
  updatedBy?: AdminReferralActor | null;
  acceptedBy?: AdminReferralActor | null;
  cancelledBy?: AdminReferralActor | null;
}

export interface IncentiveAward {
  id: number;
  role?: string | null;
  status?: string | null;
  reason?: string | null;
  freebie?: {
    id: number;
    name: string;
    type: FreebieType;
  } | null;
}

export interface IncentiveAdjustment {
  id: number;
  label: string;
  amount: number;
}

export interface EnrollmentIncentives {
  hasVoucher?: boolean;
  awards?: IncentiveAward[] | null;
  reasons?: string[] | null;
  adjustment?: IncentiveAdjustment | null;
}

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  claimed: "Code submitted",
  pending: "Pending",
  accepted: "Application accepted",
  successful: "Student enrolled",
  not_earned: "Awaiting a successful referral",
  eligible: "Awaiting billing requirements",
  applied: "Credit applied",
  applied_no_balance: "No unpaid balance",
  qualified: "Qualified",
  rejected: "Rejected",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  withdrawn: "Withdrawn",
};

export function referralStatusLabel(status?: string | null): string {
  if (!status) return "Not available";

  return (
    REFERRAL_STATUS_LABELS[status] ??
    status
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function referralStatusClassName(status?: string | null): string {
  if (!status) {
    return "border-muted bg-muted text-muted-foreground";
  }

  if (["successful", "qualified", "applied", "applied_no_balance"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (["rejected", "cancelled", "canceled", "withdrawn"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
  }
  if (["accepted", "eligible"].includes(status)) {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
}
