import type { RosterStudent } from "./types";

export function progressionNeedsSettlement(student: RosterStudent): boolean {
  if (!student.settlementBlockers?.length) return false;

  // Graduation stays academic-only. A recorded retention still needs settlement
  // before an enrollment can be created, including for top-grade students.
  return student.status === "decided"
    ? student.decision !== "graduate" && !student.materialized
    : !student.isTopGrade;
}
