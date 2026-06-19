import api from "@/lib/api";
import type { FeeStructure } from "./types";

interface Wrapped<T> {
  data: T;
}

export async function fetchFeeStructures(
  termId?: number,
): Promise<FeeStructure[]> {
  const { data } = await api.get<Wrapped<FeeStructure[]>>(
    "/admin/fee-structures",
    { params: { term_id: termId } },
  );
  return data.data;
}

export async function fetchFeeStructure(id: number): Promise<FeeStructure> {
  const { data } = await api.get<Wrapped<FeeStructure>>(
    `/admin/fee-structures/${id}`,
  );
  return data.data;
}

export async function createFeeStructure(input: {
  termId: number;
  track: string;
  yearLevel: string;
}): Promise<FeeStructure> {
  const { data } = await api.post<Wrapped<FeeStructure>>(
    "/admin/fee-structures",
    input,
  );
  return data.data;
}

export async function updateFeeStructureItems(
  id: number,
  items: { name: string; amount: number }[],
): Promise<FeeStructure> {
  const { data } = await api.put<Wrapped<FeeStructure>>(
    `/admin/fee-structures/${id}`,
    { items },
  );
  return data.data;
}

export async function deleteFeeStructure(id: number): Promise<void> {
  await api.delete(`/admin/fee-structures/${id}`);
}
