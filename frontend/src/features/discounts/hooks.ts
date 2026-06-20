import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createDiscount,
  deleteDiscount,
  fetchAllDiscounts,
  fetchDiscounts,
  updateDiscount,
  type DiscountInput,
  type DiscountListParams,
} from "./api";

export const discountsQueryKey = ["admin", "discounts"] as const;

// Paginated list for the catalog table.
export function useDiscounts(params: DiscountListParams) {
  return useQuery({
    queryKey: [...discountsQueryKey, "list", params],
    queryFn: () => fetchDiscounts(params),
    placeholderData: keepPreviousData,
  });
}

// Full catalog, for the apply-discount picker on a bill.
export function useAllDiscounts() {
  return useQuery({
    queryKey: [...discountsQueryKey, "all"],
    queryFn: fetchAllDiscounts,
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
