import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudent, fetchStudents, updateStudent } from "./api";
import type { StudentFormValues } from "./types";

export const studentsQueryKey = ["admin", "students"] as const;

export function useStudents() {
  return useQuery({
    queryKey: studentsQueryKey,
    queryFn: fetchStudents,
  });
}

export function useStudent(id: number) {
  return useQuery({
    queryKey: [...studentsQueryKey, id],
    queryFn: () => fetchStudent(id),
  });
}

export function useUpdateStudent(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: StudentFormValues) => updateStudent(id, values),
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: studentsQueryKey });
      queryClient.setQueryData([...studentsQueryKey, id], student);
    },
  });
}
