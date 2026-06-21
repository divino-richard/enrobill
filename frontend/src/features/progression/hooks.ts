import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchProgression,
  graduateStudents,
  promoteStudents,
  retainStudents,
  revertStudents,
} from "./api";

export const progressionQueryKey = ["admin", "progression"] as const;

export function useProgression() {
  return useQuery({
    queryKey: progressionQueryKey,
    queryFn: fetchProgression,
  });
}

export function usePromoteStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentIds: number[]) => promoteStudents(studentIds),
    onSuccess: () => {
      // Promoted students drop off the eligible list; their records changed too.
      queryClient.invalidateQueries({ queryKey: progressionQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
  });
}

export function useRetainStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentIds: number[]) => retainStudents(studentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: progressionQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
  });
}

export function useRevertStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentIds: number[]) => revertStudents(studentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: progressionQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
  });
}

export function useGraduateStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentIds: number[]) => graduateStudents(studentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: progressionQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
  });
}
