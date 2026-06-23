import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchEligibleFreebies,
  fetchSchoolYearFreebies,
  upsertFreebie,
} from "./api";
import type { FreebieUpsertInput } from "./types";

export const freebiesQueryKey = ["admin", "freebies"] as const;

export function useSchoolYearFreebies(schoolYearId?: number) {
  return useQuery({
    queryKey: [...freebiesQueryKey, "school-year", schoolYearId],
    queryFn: () => fetchSchoolYearFreebies(schoolYearId as number),
    enabled: schoolYearId != null,
  });
}

export function useUpsertFreebie(schoolYearId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FreebieUpsertInput) =>
      upsertFreebie(schoolYearId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: freebiesQueryKey });
    },
  });
}

export function useEligibleFreebies(enrollmentId?: number) {
  return useQuery({
    queryKey: [...freebiesQueryKey, "eligible", enrollmentId],
    queryFn: () => fetchEligibleFreebies(enrollmentId as number),
    enabled: enrollmentId != null,
  });
}
