export interface OpenTerm {
  schoolYear: string;
}

// A school year. Enrollment, admission, and billing are all keyed by this row.
export interface Term {
  id: number;
  schoolYear: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  admissionOpen: boolean;
  feesPublishedAt: string | null;
  // Effective progression state (end-date schedule + manual override + active).
  progressionOpen: boolean;
  // Raw manual override: null = follow the schedule, true/false = forced.
  progressionOverride: boolean | null;
  // Whether the end-date schedule alone would open progression.
  progressionAuto: boolean;
  downpaymentValue: number;
  installmentCount: number;
  createdAt: string | null;
}

// Installments are always on; the policy is just the downpayment + monthly count.
export interface InstallmentPolicyInput {
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

// One next step for the setup journey; the backend remains authoritative.
export function admissionReadiness(term: Term): string {
  if (!term.feesPublishedAt) return 'Review and publish fees';
  if (!term.isActive) return 'Activate year';
  return term.admissionOpen ? 'Admissions open' : 'Ready to open admissions';
}
