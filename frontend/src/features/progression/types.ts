import type { StudentDocument } from "@/features/student-documents/types";

export interface YearRef {
  id: number;
  schoolYear: string;
}

export type ProgressionDecisionKind = "promote" | "retain" | "graduate";

export const SEMESTERS = ["first", "second"] as const;
export type Semester = (typeof SEMESTERS)[number];

export type ProgressionStatus = "pending" | "decided";

export interface SemesterReview {
  clearanceCleared: boolean;
  // The reason clearance was last returned, if any — cleared once re-accepted.
  clearanceNote: string | null;
  gradesPassed: boolean;
  gradesNote: string | null;
  // Whether the file each flag depends on exists — a flag can't be set without it.
  hasClearanceDoc: boolean;
  hasGradesDoc: boolean;
}

// One row of the unified close-out roster — a student, pending or decided.
export interface RosterStudent {
  studentId: number;
  studentNumber: string;
  name: string;
  track: string | null;
  yearLevel: string | null;
  nextYearLevel: string | null;
  isTopGrade: boolean;
  documents: StudentDocument[];
  review: Record<Semester, SemesterReview>;
  // Every semester cleared and passed — the gate for promote / graduate.
  eligible: boolean;
  status: ProgressionStatus;
  decision: ProgressionDecisionKind | null;
  decisionId: number | null;
  fromYearLevel: string | null;
  toYearLevel: string | null;
  materialized: boolean | null;
  revertable: boolean | null;
}

export interface RosterFilters {
  page: number;
  perPage: number;
  search: string;
  status: ProgressionStatus | "";
  grade: string;
  program: string;
  clearance: "eligible" | "incomplete" | "";
}

export interface RosterPage {
  data: RosterStudent[];
  meta: { page: number; perPage: number; total: number; lastPage: number };
}

// Header banners and counts, fetched apart from the paginated roster.
export interface ProgressionSummary {
  activeYear: YearRef | null;
  nextYear: YearRef | null;
  progressionOpen: boolean;
  // Students still awaiting a year-end decision.
  pending: number;
  readyToEnroll: number;
  carryForward: {
    sourceYear: YearRef;
    targetYear: YearRef;
    count: number;
  } | null;
}
