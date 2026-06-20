import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { labelFor, YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import {
  createProgram,
  deleteProgram,
  fetchAdminPrograms,
  fetchPrograms,
  updateProgram,
  updateProgramFeeItems,
  type ProgramInput,
} from "./api";
import { groupActivePrograms } from "./types";

export const programsQueryKey = ["programs"] as const;
export const adminProgramsQueryKey = ["admin", "programs"] as const;

// The program catalog (active + inactive), for dropdowns and labels.
export function usePrograms() {
  return useQuery({
    queryKey: programsQueryKey,
    queryFn: fetchPrograms,
  });
}

// Grouped, active-only options for selection dropdowns.
export function useProgramGroups() {
  const { data } = usePrograms();
  return useMemo(() => groupActivePrograms(data ?? []), [data]);
}

// Resolve a program code (+ optional year level) to a display label.
export function useProgramLabel() {
  const { data } = usePrograms();
  const names = useMemo(
    () => new Map((data ?? []).map((program) => [program.code, program.name])),
    [data],
  );

  return useCallback(
    (code: string | null | undefined, yearLevel?: string | null) => {
      if (!code) return "—";
      const name = names.get(code) ?? code;
      return yearLevel
        ? `${name} · ${labelFor(YEAR_LEVEL_OPTIONS, yearLevel)}`
        : name;
    },
    [names],
  );
}

export function useAdminPrograms() {
  return useQuery({
    queryKey: adminProgramsQueryKey,
    queryFn: fetchAdminPrograms,
  });
}

function useInvalidatePrograms() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: programsQueryKey });
    queryClient.invalidateQueries({ queryKey: adminProgramsQueryKey });
  };
}

export function useCreateProgram() {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: (input: ProgramInput) => createProgram(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProgram(id: number) {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: (input: ProgramInput) => updateProgram(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateProgramFeeItems(id: number) {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: (items: { name: string; amount: number }[]) =>
      updateProgramFeeItems(id, items),
    onSuccess: invalidate,
  });
}

export function useDeleteProgram() {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: (id: number) => deleteProgram(id),
    onSuccess: invalidate,
  });
}
