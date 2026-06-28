import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignSection,
  createSection,
  deleteSection,
  fetchSections,
  fetchUnsectioned,
  updateSection,
} from "./api";
import type {
  SectionFilters,
  SectionInput,
  SectionUpdateInput,
} from "./types";

export const sectionsQueryKey = ["admin", "sections"] as const;

export function useSections(filters: SectionFilters) {
  return useQuery({
    queryKey: [...sectionsQueryKey, "list", filters],
    queryFn: () => fetchSections(filters),
  });
}

export function useUnsectionedStudents(filters: SectionFilters) {
  return useQuery({
    queryKey: [...sectionsQueryKey, "unsectioned", filters],
    queryFn: () => fetchUnsectioned(filters),
  });
}

function useInvalidateSections() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: sectionsQueryKey });
  };
}

export function useCreateSection() {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (input: SectionInput) => createSection(input),
    onSuccess: invalidate,
  });
}

export function useUpdateSection(id: number) {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (input: SectionUpdateInput) => updateSection(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSection() {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: invalidate,
  });
}

export function useAssignSection() {
  const invalidate = useInvalidateSections();
  return useMutation({
    mutationFn: ({
      enrollmentId,
      sectionId,
    }: {
      enrollmentId: number;
      sectionId: number | null;
    }) => assignSection(enrollmentId, sectionId),
    onSuccess: invalidate,
  });
}
