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

export async function fetchFeeEstimate(schoolYear: string, yearLevel: string): Promise<import('./types').FeeEstimateData> {
  const { data } = await api.get<Wrapped<import('./types').FeeEstimateData>>('/fee-estimate', {
    params: { school_year: schoolYear, year_level: yearLevel },
  });
  return data.data;
}

export async function setFeePublication(id: number, action: 'publish' | 'draft'): Promise<import('@/features/terms/types').Term> {
  const { data } = await api.post<Wrapped<import('@/features/terms/types').Term>>(`/admin/school-years/${id}/fees/${action}`);
  return data.data;
}

export async function fetchFeePaymentPreview(schoolYearId: number): Promise<import('./types').FeePaymentPreview[]> {
  const { data } = await api.get<Wrapped<import('./types').FeePaymentPreview[]>>('/admin/fees/preview', {
    params: { school_year_id: schoolYearId },
  });
  return data.data;
}
