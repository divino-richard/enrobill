import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deleteFeeStructure,
  fetchFeeStructure,
  fetchFeeStructures,
  generateFeeStructures,
  updateFeeStructureItems,
  type FeeStructureListParams,
} from "./api";

export const feeStructuresQueryKey = ["admin", "fee-structures"] as const;

export function useFeeStructures(params: FeeStructureListParams) {
  return useQuery({
    queryKey: [...feeStructuresQueryKey, "list", params],
    queryFn: () => fetchFeeStructures(params),
    placeholderData: keepPreviousData,
  });
}

export function useFeeStructure(id: number) {
  return useQuery({
    queryKey: [...feeStructuresQueryKey, "detail", id],
    queryFn: () => fetchFeeStructure(id),
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

export function useGenerateFeeStructures() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateFeeStructures,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeStructuresQueryKey });
    },
  });
}
