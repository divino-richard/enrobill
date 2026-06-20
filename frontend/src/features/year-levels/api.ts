import api from "@/lib/api";
import type { YearLevel } from "./types";

interface Wrapped<T> {
  data: T;
}

export interface YearLevelInput {
  name: string;
  isActive: boolean;
}

// The year level catalog (active + inactive), for dropdowns and labels.
export async function fetchYearLevels(): Promise<YearLevel[]> {
  const { data } = await api.get<Wrapped<YearLevel[]>>("/year-levels");
  return data.data;
}

export async function createYearLevel(
  input: YearLevelInput,
): Promise<YearLevel> {
  const { data } = await api.post<Wrapped<YearLevel>>(
    "/admin/year-levels",
    input,
  );
  return data.data;
}

export async function updateYearLevel(
  id: number,
  input: YearLevelInput,
): Promise<YearLevel> {
  const { data } = await api.put<Wrapped<YearLevel>>(
    `/admin/year-levels/${id}`,
    input,
  );
  return data.data;
}

export async function deleteYearLevel(id: number): Promise<void> {
  await api.delete(`/admin/year-levels/${id}`);
}
