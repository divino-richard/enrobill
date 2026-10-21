import { isAxiosError } from "axios";
import type { TeacherGradesData } from "./types";

export function getTeacherRosterState(data: TeacherGradesData | undefined, search: string) {
  const searchTerm = search.trim().toLowerCase();
  const roster = data?.sections.filter(section => section.students.length > 0) ?? [];
  const hasStudents = roster.length > 0;
  const sections = searchTerm
    ? roster.map(section => ({
        ...section,
        students: section.students.filter(student =>
          `${student.name} ${student.studentNumber}`.toLowerCase().includes(searchTerm),
        ),
      })).filter(section => section.students.length > 0)
    : roster;
  const studentCount = sections.reduce((count, section) => count + section.students.length, 0);
  // Available school years come from adviser assignments, even when their sections have no enrolled students.
  const hasAssignment = data?.schoolYears.some(year => year.id === data.schoolYearId) ?? false;
  const emptyState = hasStudents && searchTerm && studentCount === 0
    ? {
        kind: "search" as const,
        title: "No matching students",
        description: "Try another name or student number.",
      }
    : hasAssignment
      ? {
          kind: "enrollment" as const,
          title: "No enrolled students yet",
          description: "Students will appear once they are enrolled in your assigned sections.",
        }
      : {
          kind: "assignment" as const,
          title: "No advisory section assigned",
          description: "Ask a school administrator to assign you to a section for this school year.",
        };

  return { sections, studentCount, hasStudents, searchTerm, emptyState };
}

export function getTeacherRosterError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 422) {
    return {
      title: "No school year available",
      description: "A school administrator needs to make a school year available before students can appear here.",
      action: "Check again",
      resetYear: false,
    };
  }
  if (status === 404) {
    return {
      title: "School year unavailable",
      description: "This school year is no longer available to you. Check for another year with an adviser assignment.",
      action: "Check available school years",
      resetYear: true,
    };
  }
  return {
    title: "Couldn't load your students",
    description: "Please try again. If this continues, contact a school administrator.",
    action: "Try again",
    resetYear: false,
  };
}
