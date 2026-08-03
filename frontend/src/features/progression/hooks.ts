import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  decideProgression,
  fetchProgressionRoster,
  fetchProgressionSummary,
  materializeProgression,
  reviewSemester,
  revertProgression,
} from "./api";
import type {
  ProgressionDecisionKind,
  RosterFilters,
  Semester,
} from "./types";

export const progressionQueryKey = ["admin", "progression"] as const;
export const rosterQueryKey = ["admin", "progression", "roster"] as const;
const studentsQueryKey = ["admin", "students"] as const;

export function useProgressionSummary() {
  return useQuery({
    queryKey: progressionQueryKey,
    queryFn: fetchProgressionSummary,
  });
}

// The paginated roster. Previous page's data is kept while the next loads, so
// paging and filtering don't flash an empty table.
export function useProgressionRoster(filters: RosterFilters) {
  return useQuery({
    queryKey: [...rosterQueryKey, filters],
    queryFn: () => fetchProgressionRoster(filters),
    placeholderData: keepPreviousData,
  });
}

// Any decision changes standing and the close-out queues, so refresh the roster,
// the summary counts, and the students list.
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

// Accept or return one requirement (clearance or grades) for a semester.
export function useReviewSemester() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      studentId: number;
      semester: Semester;
      field: "clearance" | "grades";
      accepted: boolean;
      note?: string;
    }) => reviewSemester(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rosterQueryKey });
    },
  });
}
