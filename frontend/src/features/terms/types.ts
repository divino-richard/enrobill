export interface OpenTerm {
  schoolYear: string;
}

export type DownpaymentType = "percentage" | "fixed";

// A school year. Enrollment, admission, and billing are all keyed by this row.
export interface Term {
  id: number;
  schoolYear: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  admissionOpen: boolean;
  // Effective progression state (end-date schedule + manual override + active).
  progressionOpen: boolean;
  // Raw manual override: null = follow the schedule, true/false = forced.
  progressionOverride: boolean | null;
  // Whether the end-date schedule alone would open progression.
  progressionAuto: boolean;
  downpaymentType: DownpaymentType;
  downpaymentValue: number;
  installmentCount: number;
  createdAt: string | null;
}

// Installments are always on; the policy is just the downpayment + monthly count.
export interface InstallmentPolicyInput {
  downpaymentType: DownpaymentType;
  downpaymentValue: number;
  installmentCount: number;
}

export interface TermInput extends InstallmentPolicyInput {
  startDate: string;
  endDate: string;
}

export function termLabel(term: Term): string {
  return `SY ${term.schoolYear}`;
}
