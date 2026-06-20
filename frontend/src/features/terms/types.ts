export type TermSemester = "first" | "second";

export type DownpaymentType = "percentage" | "fixed";

export interface Term {
  id: number;
  schoolYear: string;
  semester: TermSemester;
  startDate: string | null;
  endDate: string | null;
  isOpen: boolean;
  installmentsEnabled: boolean;
  downpaymentType: DownpaymentType | null;
  downpaymentValue: number | null;
  installmentCount: number | null;
  createdAt: string | null;
}

export interface InstallmentPolicyInput {
  installmentsEnabled: boolean;
  downpaymentType: DownpaymentType | null;
  downpaymentValue: number | null;
  installmentCount: number | null;
}

export interface TermInput extends InstallmentPolicyInput {
  schoolYear: string;
  semester: TermSemester;
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
  return `${semesterLabel(term.semester)} · SY ${term.schoolYear}`;
}
