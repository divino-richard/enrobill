import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createYearLevel,
  deleteYearLevel,
  fetchYearLevels,
  updateYearLevel,
  type YearLevelInput,
} from "./api";

export const yearLevelsQueryKey = ["year-levels"] as const;

// The year level catalog (active + inactive), for dropdowns and labels.
export function useYearLevels() {
  return useQuery({
    queryKey: yearLevelsQueryKey,
    queryFn: fetchYearLevels,
  });
}

// Active-only options for selection dropdowns.
export function useYearLevelOptions() {
  const { data } = useYearLevels();
  return useMemo(
    () =>
      (data ?? [])
        .filter((level) => level.isActive)
        .map((level) => ({ value: level.code, label: level.name })),
    [data],
  );
}

// Resolve a year level code to its display name.
export function useYearLevelLabel() {
  const { data } = useYearLevels();
  const names = useMemo(
    () => new Map((data ?? []).map((level) => [level.code, level.name])),
    [data],
  );

  return useCallback(
    (code: string | null | undefined) => (code ? (names.get(code) ?? code) : "—"),
    [names],
  );
}

function useInvalidateYearLevels() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: yearLevelsQueryKey });
}

export function useCreateYearLevel() {
  const invalidate = useInvalidateYearLevels();
  return useMutation({
    mutationFn: (input: YearLevelInput) => createYearLevel(input),
    onSuccess: invalidate,
  });
}

export function useUpdateYearLevel(id: number) {
  const invalidate = useInvalidateYearLevels();
  return useMutation({
    mutationFn: (input: YearLevelInput) => updateYearLevel(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteYearLevel() {
  const invalidate = useInvalidateYearLevels();
  return useMutation({
    mutationFn: (id: number) => deleteYearLevel(id),
    onSuccess: invalidate,
  });
}
