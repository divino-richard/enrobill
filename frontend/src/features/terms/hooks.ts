import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTerm,
  deleteTerm,
  fetchTerms,
  setTermOpen,
} from "./api";
import type { TermSemester } from "./types";

export const termsQueryKey = ["admin", "terms"] as const;

export function useTerms() {
  return useQuery({
    queryKey: termsQueryKey,
    queryFn: fetchTerms,
  });
}

export function useCreateTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { schoolYear: string; semester: TermSemester }) =>
      createTerm(input),
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

export function useDeleteTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTerm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: termsQueryKey });
    },
  });
}
