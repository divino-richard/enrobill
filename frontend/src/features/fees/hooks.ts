import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  copyFees,
  createFee,
  deleteFee,
  fetchFees,
  updateFee,
} from "./api";
import type { FeeInput } from "./types";

export const feesQueryKey = ["admin", "fees"] as const;

export function useFees(schoolYearId?: number) {
  return useQuery({
    queryKey: [...feesQueryKey, schoolYearId ?? "active"],
    queryFn: () => fetchFees(schoolYearId),
  });
}

export function useCreateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeInput) => createFee(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feesQueryKey });
    },
  });
}

export function useUpdateFee(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeeInput) => updateFee(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feesQueryKey });
    },
  });
}

export function useDeleteFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feesQueryKey });
    },
  });
}

export function useCopyFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) =>
      copyFees(from, to),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feesQueryKey });
    },
  });
}
