import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFeeStructure,
  deleteFeeStructure,
  fetchFeeStructure,
  fetchFeeStructures,
  updateFeeStructureItems,
} from "./api";

export const feeStructuresQueryKey = ["admin", "fee-structures"] as const;

export function useFeeStructures() {
  return useQuery({
    queryKey: [...feeStructuresQueryKey, "list"],
    queryFn: () => fetchFeeStructures(),
  });
}

export function useFeeStructure(id: number) {
  return useQuery({
    queryKey: [...feeStructuresQueryKey, "detail", id],
    queryFn: () => fetchFeeStructure(id),
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { termId: number; track: string; yearLevel: string }) =>
      createFeeStructure(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeStructuresQueryKey });
    },
  });
}

export function useUpdateFeeStructureItems(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { name: string; amount: number }[]) =>
      updateFeeStructureItems(id, items),
    onSuccess: (structure) => {
      queryClient.invalidateQueries({ queryKey: feeStructuresQueryKey });
      queryClient.setQueryData(
        [...feeStructuresQueryKey, "detail", id],
        structure,
      );
    },
  });
}

export function useDeleteFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFeeStructure(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeStructuresQueryKey });
    },
  });
}
