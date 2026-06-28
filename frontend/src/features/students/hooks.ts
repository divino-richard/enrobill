import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchMyEnrollments,
  fetchMyStudent,
  fetchStudent,
  fetchStudentEnrollments,
  fetchStudents,
  updateEnrollmentStatus,
  updateStudent,
  type StudentListParams,
} from "./api";
import type { EnrollmentStatus, StudentFormValues } from "./types";

export const studentsQueryKey = ["admin", "students"] as const;
export const myStudentQueryKey = ["me", "student"] as const;
export const myEnrollmentsQueryKey = ["me", "enrollments"] as const;

// The signed-in user's own student record.
export function useMyStudent() {
  return useQuery({
    queryKey: myStudentQueryKey,
    queryFn: fetchMyStudent,
    retry: false,
  });
}

// The signed-in student's per-term enrollment history.
export function useMyEnrollments() {
  return useQuery({
    queryKey: myEnrollmentsQueryKey,
    queryFn: fetchMyEnrollments,
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

// A student's per-term enrollments (admin view).
export function useStudentEnrollments(studentId: number) {
  return useQuery({
    queryKey: [...studentsQueryKey, "enrollments", studentId],
    queryFn: () => fetchStudentEnrollments(studentId),
  });
}

export function useUpdateEnrollmentStatus(studentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      enrollmentId,
      status,
    }: {
      enrollmentId: number;
      status: EnrollmentStatus;
    }) => updateEnrollmentStatus(enrollmentId, status),
    onSuccess: () => {
      // The student's mirrored status may have changed too.
      queryClient.invalidateQueries({
        queryKey: [...studentsQueryKey, "enrollments", studentId],
      });
      queryClient.invalidateQueries({
        queryKey: [...studentsQueryKey, "detail", studentId],
      });
      queryClient.invalidateQueries({ queryKey: studentsQueryKey });
    },
  });
}
