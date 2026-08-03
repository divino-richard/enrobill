import api from "@/lib/api";
import type {
  ProgressionDecisionKind,
  ProgressionSummary,
  RosterFilters,
  RosterPage,
  Semester,
} from "./types";

interface Wrapped<T> {
  data: T;
}

// Close-out summary for the active year (banners + counts).
export async function fetchProgressionSummary(): Promise<ProgressionSummary> {
  const { data } = await api.get<Wrapped<ProgressionSummary>>(
    "/admin/progression",
  );
  return data.data;
}

// The unified, filtered, server-paginated close-out roster.
export async function fetchProgressionRoster(
  filters: RosterFilters,
): Promise<RosterPage> {
  const params: Record<string, string | number> = {
    page: filters.page,
    perPage: filters.perPage,
  };
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.grade) params.grade = filters.grade;
  if (filters.program) params.program = filters.program;
  if (filters.clearance) params.clearance = filters.clearance;

  const { data } = await api.get<RosterPage>("/admin/progression/students", {
    params,
  });
  return data;
}

// Record a decision for the selected students. Returns how many were decided.
export async function decideProgression(
  studentIds: number[],
  decision: ProgressionDecisionKind,
): Promise<number> {
  const { data } = await api.post<Wrapped<{ decided: number }>>(
    "/admin/progression/decide",
    { studentIds, decision },
  );
  return data.data.decided;
}

// Enroll all promote/retain decisions into the next school year.
export async function materializeProgression(): Promise<number> {
  const { data } = await api.post<Wrapped<{ materialized: number }>>(
    "/admin/progression/materialize",
    {},
  );
  return data.data.materialized;
}

// Undo the selected decisions. Returns how many were reverted.
export async function revertProgression(
  decisionIds: number[],
): Promise<number> {
  const { data } = await api.post<Wrapped<{ reverted: number }>>(
    "/admin/progression/revert",
    { decisionIds },
  );
  return data.data.reverted;
}

// Accept or return one requirement (clearance or grades) for a semester;
// returns whether the student is now eligible for promotion/graduation.
// Returning (accepted: false) requires a note — it's what unlocks the file
// for the student to replace.
export async function reviewSemester(input: {
  studentId: number;
  semester: Semester;
  field: "clearance" | "grades";
  accepted: boolean;
  note?: string;
}): Promise<boolean> {
  const { data } = await api.post<Wrapped<{ eligible: boolean }>>(
    "/admin/progression/review",
    input,
  );
  return data.data.eligible;
}
