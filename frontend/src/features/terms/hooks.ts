import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTerm,
  deleteTerm,
  fetchOpenTerm,
  fetchTerms,
  setTermOpen,
  updateTermPolicy,
} from "./api";
import type { InstallmentPolicyInput, TermInput } from "./types";

export const termsQueryKey = ["admin", "terms"] as const;
export const openTermQueryKey = ["open-term"] as const;

export function useTerms() {
  return useQuery({
    queryKey: termsQueryKey,
    queryFn: fetchTerms,
  });
}

// The currently open enrollment term (or null). Available to applicants.
export function useOpenTerm() {
  return useQuery({
    queryKey: openTermQueryKey,
    queryFn: fetchOpenTerm,
  });
}

export function useCreateTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TermInput) => createTerm(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termsQueryKey });
    },
  });
}

export function useSetTermOpen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isOpen }: { id: number; isOpen: boolean }) =>
      setTermOpen(id, isOpen),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termsQueryKey });
    },
  });
}

export function useUpdateTermPolicy(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InstallmentPolicyInput) => updateTermPolicy(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termsQueryKey });
    },
  });
}

export function useDeleteTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTerm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termsQueryKey });
    },
  });
}
