// A continuing student eligible to be advanced a grade.
export interface PromoteCandidate {
  id: number;
  studentNumber: string;
  name: string;
  track: string | null;
  currentYearLevel: string | null;
  nextYearLevel: string | null;
}

// A student whose decision can still be undone (billed, but no payments yet).
export interface RevertCandidate {
  id: number;
  studentNumber: string;
  name: string;
  track: string | null;
  currentYearLevel: string | null;
  previousYearLevel: string | null;
}

// A finishing top-grade student ready to graduate.
export interface GraduateCandidate {
  id: number;
  studentNumber: string;
  name: string;
  track: string | null;
  currentYearLevel: string | null;
}

export interface ProgressionInfo {
  // The open term whose school year progression targets, or null if none open.
  openTerm: { schoolYear: string; semester: string } | null;
  candidates: PromoteCandidate[];
  revertible: RevertCandidate[];
  graduates: GraduateCandidate[];
}
