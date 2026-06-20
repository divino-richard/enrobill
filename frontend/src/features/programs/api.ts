import api from "@/lib/api";
import type { Program } from "./types";

interface Wrapped<T> {
  data: T;
}

export interface ProgramInput {
  name: string;
  category: string;
  isActive: boolean;
}

// The program catalog, for dropdowns and label resolution (any authed user).
export async function fetchPrograms(): Promise<Program[]> {
  const { data } = await api.get<Wrapped<Program[]>>("/programs");
  return data.data;
}

// The full catalog with fee items (admin management).
export async function fetchAdminPrograms(): Promise<Program[]> {
  const { data } = await api.get<Wrapped<Program[]>>("/admin/programs");
  return data.data;
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

export async function updateProgramFeeItems(
  id: number,
  items: { name: string; amount: number }[],
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
