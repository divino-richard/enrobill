import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type { FeeStructure } from "./types";

interface Wrapped<T> {
  data: T;
}

export type FeeStructureListParams = ListParams;

export interface FeeStructuresPage {
  rows: FeeStructure[];
  meta: PageMeta;
}

// Paginated / searchable / sortable fee structures, filterable by term.
export async function fetchFeeStructures(
  params: FeeStructureListParams,
): Promise<FeeStructuresPage> {
  const { data } = await api.get<LaravelPaginated<FeeStructure>>(
    "/admin/fee-structures",
    { params: listParamsToQuery(params) },
  );
  return { rows: data.data, meta: toPageMeta(data.meta) };
}

export async function fetchFeeStructure(id: number): Promise<FeeStructure> {
  const { data } = await api.get<Wrapped<FeeStructure>>(
    `/admin/fee-structures/${id}`,
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

// Bulk-generate structures for every program missing one in the open term.
export async function generateFeeStructures(): Promise<{ created: number }> {
  const { data } = await api.post<{ created: number }>(
    "/admin/fee-structures/generate",
  );
  return data;
}
