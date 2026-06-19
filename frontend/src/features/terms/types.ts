export type TermSemester = "first" | "second";

export interface Term {
  id: number;
  schoolYear: string;
  semester: TermSemester;
  isOpen: boolean;
  createdAt: string | null;
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
