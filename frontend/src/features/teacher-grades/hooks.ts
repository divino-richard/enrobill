import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store";
import type { Semester } from "@/features/student-documents/types";
import { fetchTeacherGrades, removeTeacherGrade, uploadTeacherGrade } from "./api";

export const teacherGradesQueryKey = ["teacher", "grades"] as const;

export function useTeacherGrades(schoolYearId?: number) {
  const teacherId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: [...teacherGradesQueryKey, teacherId, schoolYearId],
    queryFn: () => fetchTeacherGrades(schoolYearId),
  });
}

export function useUploadTeacherGrade(studentId: number, schoolYearId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      semester,
      file,
      onProgress,
    }: {
      semester: Semester;
      file: File;
      onProgress?: (percent: number) => void;
    }) => uploadTeacherGrade(studentId, schoolYearId, semester, file, onProgress),
    onSuccess: (document) => {
      queryClient.removeQueries({ queryKey: ["teacher-grade-document", document.id] });
      return queryClient.invalidateQueries({ queryKey: teacherGradesQueryKey });
    },
  });
}

export function useRemoveTeacherGrade(studentId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: number) => removeTeacherGrade(studentId, documentId),
    onSuccess: (_, documentId) => {
      queryClient.removeQueries({ queryKey: ["teacher-grade-document", documentId] });
      return queryClient.invalidateQueries({ queryKey: teacherGradesQueryKey });
    },
  });
}
