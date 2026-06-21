import api from "@/lib/api";
import type { ProgressionInfo } from "./types";

interface Wrapped<T> {
  data: T;
}

// Year-end queues + the target school year (admin only).
export async function fetchProgression(): Promise<ProgressionInfo> {
  const { data } = await api.get<Wrapped<ProgressionInfo>>("/admin/progression");
  return data.data;
}

// Advance the selected students to the next grade. Returns how many promoted.
export async function promoteStudents(studentIds: number[]): Promise<number> {
  const { data } = await api.post<Wrapped<{ promoted: number }>>(
    "/admin/progression",
    { studentIds },
  );
  return data.data.promoted;
}

// Retain the selected students at their current grade. Returns how many were
// retained.
export async function retainStudents(studentIds: number[]): Promise<number> {
  const { data } = await api.post<Wrapped<{ retained: number }>>(
    "/admin/progression/retain",
    { studentIds },
  );
  return data.data.retained;
}

// Undo the decision for the selected students. Returns how many were reverted.
export async function revertStudents(studentIds: number[]): Promise<number> {
  const { data } = await api.post<Wrapped<{ reverted: number }>>(
    "/admin/progression/revert",
    { studentIds },
  );
  return data.data.reverted;
}

// Graduate the selected finishing students. Returns how many were graduated.
export async function graduateStudents(studentIds: number[]): Promise<number> {
  const { data } = await api.post<Wrapped<{ graduated: number }>>(
    "/admin/progression/graduate",
    { studentIds },
  );
  return data.data.graduated;
}
