import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDiscount,
  deleteDiscount,
  fetchDiscounts,
  updateDiscount,
  type DiscountInput,
} from "./api";

export const discountsQueryKey = ["admin", "discounts"] as const;

export function useDiscounts() {
  return useQuery({
    queryKey: discountsQueryKey,
    queryFn: fetchDiscounts,
  });
}

export function useCreateDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DiscountInput) => createDiscount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountsQueryKey });
    },
  });
}

export function useUpdateDiscount(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DiscountInput) => updateDiscount(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountsQueryKey });
    },
  });
}

export function useDeleteDiscount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteDiscount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountsQueryKey });
    },
  });
}
