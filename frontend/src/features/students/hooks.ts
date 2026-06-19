import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchMyStudent,
  fetchStudent,
  fetchStudents,
  updateStudent,
  type StudentListParams,
} from "./api";
import type { StudentFormValues } from "./types";

export const studentsQueryKey = ["admin", "students"] as const;
export const myStudentQueryKey = ["me", "student"] as const;

// The signed-in user's own student record.
export function useMyStudent() {
  return useQuery({
    queryKey: myStudentQueryKey,
    queryFn: fetchMyStudent,
    retry: false,
  });
}

export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: [...studentsQueryKey, "list", params],
    queryFn: () => fetchStudents(params),
    // Keep the previous page visible while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useStudent(id: number) {
  return useQuery({
    queryKey: [...studentsQueryKey, "detail", id],
    queryFn: () => fetchStudent(id),
  });
}

export function useUpdateStudent(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: StudentFormValues) => updateStudent(id, values),
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: studentsQueryKey });
      queryClient.setQueryData([...studentsQueryKey, "detail", id], student);
    },
  });
}
