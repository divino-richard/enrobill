export type FreebieType = "early_enrollment" | "referral";

// A per-school-year promo that (with a voucher) zeroes the remaining balance.
export interface Freebie {
  id: number;
  schoolYearId: number;
  type: FreebieType;
  name: string;
  isActive: boolean;
  startsOn: string | null;
  endsOn: string | null;
  minReferrals: number | null;
}

export interface FreebieUpsertInput {
  type: FreebieType;
  name: string;
  isActive: boolean;
  startsOn: string | null;
  endsOn: string | null;
  minReferrals?: number | null;
}

export function freebieTypeLabel(type: string): string {
  switch (type) {
    case "early_enrollment":
      return "Early Enrollment";
    case "referral":
      return "Referral";
    default:
      return type;
  }
}
