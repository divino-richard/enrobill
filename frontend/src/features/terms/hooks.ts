import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTerm,
  deleteTerm,
  fetchOpenTerm,
  fetchTerms,
  updateTermPolicy,
  updateTermStatus,
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

export function useUpdateTermStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...changes
    }: {
      id: number;
      isActive?: boolean;
      admissionOpen?: boolean;
      progressionOpen?: boolean | null;
    }) => updateTermStatus(id, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termsQueryKey });
      // The active/admission change affects the applicant-facing open term too.
      queryClient.invalidateQueries({ queryKey: openTermQueryKey });
      // Toggling progression opens/closes the year-end queues on the Students page.
      queryClient.invalidateQueries({ queryKey: ["admin", "progression"] });
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
