import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type { Program } from "./types";

interface Wrapped<T> {
  data: T;
}

export interface ProgramInput {
  name: string;
  category: string;
  isActive: boolean;
}

export type ProgramListParams = ListParams;

export interface ProgramsPage {
  rows: Program[];
  meta: PageMeta;
}

// The program catalog, for dropdowns and label resolution (any authed user).
export async function fetchPrograms(): Promise<Program[]> {
  const { data } = await api.get<Wrapped<Program[]>>("/programs");
  return data.data;
}

// Paginated / searchable / sortable catalog with fee items (admin management).
export async function fetchAdminPrograms(
  params: ProgramListParams,
): Promise<ProgramsPage> {
  const { data } = await api.get<LaravelPaginated<Program>>("/admin/programs", {
    params: listParamsToQuery(params),
  });
  return { rows: data.data, meta: toPageMeta(data.meta) };
}

export async function createProgram(input: ProgramInput): Promise<Program> {
  const { data } = await api.post<Wrapped<Program>>("/admin/programs", input);
  return data.data;
}

export async function updateProgram(
  id: number,
  input: ProgramInput,
): Promise<Program> {
  const { data } = await api.put<Wrapped<Program>>(
    `/admin/programs/${id}`,
    input,
  );
  return data.data;
}

export interface ProgramFeeItemInput {
  name: string;
  // Amount per year level code; null (or omitted) means not charged for it.
  amounts: Record<string, number | null>;
}

export async function updateProgramFeeItems(
  id: number,
  items: ProgramFeeItemInput[],
): Promise<Program> {
  const { data } = await api.put<Wrapped<Program>>(
    `/admin/programs/${id}/fee-items`,
    { items },
  );
  return data.data;
}

export async function deleteProgram(id: number): Promise<void> {
  await api.delete(`/admin/programs/${id}`);
}
