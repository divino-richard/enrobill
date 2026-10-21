import type { Section, UnsectionedStudent } from "./types";

export function getSectionAssignmentState(
  section: Section,
  sections: Section[],
  unsectioned: UnsectionedStudent[],
) {
  const matchingSections = sections.filter(candidate =>
    candidate.id !== section.id &&
    candidate.schoolYearId === section.schoolYearId &&
    candidate.program === section.program &&
    candidate.yearLevel === section.yearLevel,
  );
  return {
    addable: unsectioned.filter(student =>
      student.program === section.program && student.yearLevel === section.yearLevel,
    ),
    moveTargets: matchingSections.filter(candidate => candidate.assignedCount < candidate.capacity),
    moveUnavailableTitle: matchingSections.length === 0
      ? "No other matching sections"
      : "Matching sections are full",
    moveUnavailableReason: matchingSections.length === 0
      ? "Create another section for the same school year, program and grade, then move this student."
      : "Free up a seat or increase the capacity of another section in this program and grade, then try again.",
  };
}
