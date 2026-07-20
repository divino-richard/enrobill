import type { StudentDocument } from "@/features/student-documents/types";

// A pointer to a school year.
export interface YearRef {
  id: number;
  schoolYear: string;
}

// The year-end decisions an admin can record for a student.
export type ProgressionDecisionKind = "promote" | "retain" | "graduate";

// An enrolled student in the ending year still awaiting a year-end decision.
export interface CloseoutStudent {
  studentId: number;
  studentNumber: string;
  name: string;
  track: string | null;
  yearLevel: string | null;
  // The grade this student would advance to if promoted.
  nextYearLevel: string | null;
  isTopGrade: boolean;
  // Clearance / grade slips the student uploaded for the ending year — what the
  // admin reads to judge pass (promote) or fail (retain).
  documents: StudentDocument[];
}

// A decision already recorded for the ending year.
export interface CloseoutDecision {
  id: number;
  studentId: number;
  studentNumber: string;
  name: string;
  track: string | null;
  decision: ProgressionDecisionKind;
  fromYearLevel: string | null;
  toYearLevel: string | null;
  // Whether the promote/retain decision has been enrolled into the next year.
  materialized: boolean;
  // False once a materialized next-year enrollment has been billed.
  revertable: boolean;
}

export interface ProgressionInfo {
  // The active (ending) school year the close-out targets, or null if none.
  activeYear: YearRef | null;
  // The next school year promote/retain decisions enroll into, if it exists yet.
  nextYear: YearRef | null;
  // Whether the active year's progression window is open.
  progressionOpen: boolean;
  pending: CloseoutStudent[];
  decided: CloseoutDecision[];
}
