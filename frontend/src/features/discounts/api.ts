import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type { Discount, DiscountCategory, DiscountType } from "./types";

interface Wrapped<T> {
  data: T;
}

export interface DiscountInput {
  name: string;
  category: DiscountCategory;
  type: DiscountType;
  value: number;
  isActive: boolean;
}

export type DiscountListParams = ListParams;

export interface DiscountsPage {
  rows: Discount[];
  meta: PageMeta;
}

// Paginated / searchable / sortable discount catalog (admin).
export async function fetchDiscounts(
  params: DiscountListParams,
): Promise<DiscountsPage> {
  const { data } = await api.get<LaravelPaginated<Discount>>(
    "/admin/discounts",
    { params: listParamsToQuery(params) },
  );
  return { rows: data.data, meta: toPageMeta(data.meta) };
}

// The full catalog (first 100), for the apply-discount picker on bills.
export async function fetchAllDiscounts(): Promise<Discount[]> {
  const { data } = await api.get<LaravelPaginated<Discount>>(
    "/admin/discounts",
    { params: { per_page: 100 } },
  );
  return data.data;
}

export async function createDiscount(input: DiscountInput): Promise<Discount> {
  const { data } = await api.post<Wrapped<Discount>>("/admin/discounts", input);
  return data.data;
}

export async function updateDiscount(
  id: number,
  input: DiscountInput,
): Promise<Discount> {
  const { data } = await api.put<Wrapped<Discount>>(
    `/admin/discounts/${id}`,
    input,
  );
  return data.data;
}

export async function deleteDiscount(id: number): Promise<void> {
  await api.delete(`/admin/discounts/${id}`);
}
