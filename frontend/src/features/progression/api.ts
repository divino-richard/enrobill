import api from "@/lib/api";
import type { ProgressionDecisionKind, ProgressionInfo } from "./types";

interface Wrapped<T> {
  data: T;
}

// The year-end close-out for the active school year (admin only).
export async function fetchProgression(): Promise<ProgressionInfo> {
  const { data } = await api.get<Wrapped<ProgressionInfo>>("/admin/progression");
  return data.data;
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

// Enroll all promote/retain decisions into the next school year. Returns how
// many were materialized.
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
