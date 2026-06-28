export type TermSemester = "first" | "second";

// The minimal open info exposed to applicants (school year + current semester).
export interface OpenTerm {
  schoolYear: string;
  semester: TermSemester;
}

export type DownpaymentType = "percentage" | "fixed";

// A school year. The semester is just a pointer that tracks progress within it;
// enrollment, admission and billing are all keyed by the school year itself.
export interface Term {
  id: number;
  schoolYear: string;
  currentSemester: TermSemester;
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
  schoolYear: string;
  startDate: string;
  endDate: string;
}

export const TERM_SEMESTER_OPTIONS = [
  { value: "first", label: "1st Semester" },
  { value: "second", label: "2nd Semester" },
] as const;

export function semesterLabel(value: string): string {
  return (
    TERM_SEMESTER_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export function termLabel(term: Term): string {
  return `SY ${term.schoolYear}`;
}
