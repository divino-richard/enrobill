import api from "@/lib/api";
import type { FeeInput, SchoolYearFee } from "./types";

interface Wrapped<T> {
  data: T;
}

// The fee schedule for a school year (defaults to the active one server-side).
export async function fetchFees(
  schoolYearId?: number,
): Promise<SchoolYearFee[]> {
  const { data } = await api.get<Wrapped<SchoolYearFee[]>>("/admin/fees", {
    params: schoolYearId ? { school_year_id: schoolYearId } : undefined,
  });
  return data.data;
}

export async function createFee(input: FeeInput): Promise<SchoolYearFee> {
  const { data } = await api.post<Wrapped<SchoolYearFee>>("/admin/fees", input);
  return data.data;
}

export async function updateFee(
  id: number,
  input: FeeInput,
): Promise<SchoolYearFee> {
  const { data } = await api.put<Wrapped<SchoolYearFee>>(
    `/admin/fees/${id}`,
    input,
  );
  return data.data;
}

export async function deleteFee(id: number): Promise<void> {
  await api.delete(`/admin/fees/${id}`);
}

// Copy a whole fee schedule from one school year into an empty one.
export async function copyFees(
  fromSchoolYearId: number,
  toSchoolYearId: number,
): Promise<SchoolYearFee[]> {
  const { data } = await api.post<Wrapped<SchoolYearFee[]>>("/admin/fees/copy", {
    fromSchoolYearId,
    toSchoolYearId,
  });
  return data.data;
}
