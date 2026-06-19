import api from "@/lib/api";
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

// The reusable discount catalog (admin).
export async function fetchDiscounts(): Promise<Discount[]> {
  const { data } = await api.get<Wrapped<Discount[]>>("/admin/discounts");
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
