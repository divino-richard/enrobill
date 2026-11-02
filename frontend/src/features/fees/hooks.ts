import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFeeEstimate,
  fetchFeePaymentPreview,
  setFeePublication,
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

export function useFeeEstimate(schoolYear: string, yearLevel: string) {
  return useQuery({
    queryKey: ['fee-estimate', schoolYear, yearLevel],
    queryFn: () => fetchFeeEstimate(schoolYear, yearLevel),
    enabled: Boolean(schoolYear && yearLevel),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useFeePublication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'publish' | 'draft' }) => setFeePublication(id, action),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'terms'] }),
        client.invalidateQueries({ queryKey: ['open-term'] }),
        client.invalidateQueries({ queryKey: ['fee-estimate'] }),
        client.invalidateQueries({ queryKey: feesQueryKey }),
      ]);
    },
  });
}

export function useFeePaymentPreview(schoolYearId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...feesQueryKey, 'payment-preview', schoolYearId],
    queryFn: () => fetchFeePaymentPreview(schoolYearId),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
