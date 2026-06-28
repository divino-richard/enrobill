import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideProgression,
  fetchProgression,
  materializeProgression,
  revertProgression,
} from "./api";
import type { ProgressionDecisionKind } from "./types";

export const progressionQueryKey = ["admin", "progression"] as const;
const studentsQueryKey = ["admin", "students"] as const;

export function useProgression() {
  return useQuery({
    queryKey: progressionQueryKey,
    queryFn: fetchProgression,
  });
}

// Year-end decisions and materialization both change student standing and the
// close-out queues, so they invalidate progression and the students list.
function useCloseoutInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: progressionQueryKey });
    queryClient.invalidateQueries({ queryKey: studentsQueryKey });
  };
}

export function useDecideProgression() {
  const invalidate = useCloseoutInvalidation();

  return useMutation({
    mutationFn: ({
      studentIds,
      decision,
    }: {
      studentIds: number[];
      decision: ProgressionDecisionKind;
    }) => decideProgression(studentIds, decision),
    onSuccess: invalidate,
  });
}

export function useMaterializeProgression() {
  const invalidate = useCloseoutInvalidation();

  return useMutation({
    mutationFn: () => materializeProgression(),
    onSuccess: invalidate,
  });
}

export function useRevertProgression() {
  const invalidate = useCloseoutInvalidation();

  return useMutation({
    mutationFn: (decisionIds: number[]) => revertProgression(decisionIds),
    onSuccess: invalidate,
  });
}
