import axios from "axios";
import api from "@/lib/api";
import type { Semester, StudentDocument } from "@/features/student-documents/types";
import type { TeacherGradesData } from "./types";

interface Wrapped<T> {
  data: T;
}

interface PresignResponse {
  key: string;
  url: string;
  headers: Record<string, string | string[]>;
}

export async function fetchTeacherGrades(schoolYearId?: number): Promise<TeacherGradesData> {
  const { data } = await api.get<Wrapped<TeacherGradesData>>("/teacher/grades", {
    params: schoolYearId ? { schoolYearId } : undefined,
  });
  return data.data;
}

export async function uploadTeacherGrade(
  studentId: number,
  schoolYearId: number,
  semester: Semester,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<StudentDocument> {
  const { data: signed } = await api.post<PresignResponse>(
    `/teacher/students/${studentId}/grades/presign`,
    { school_year_id: schoolYearId, semester, content_type: file.type, size: file.size },
  );

  await axios.put(signed.url, file, {
    headers: { "Content-Type": file.type },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const { data } = await api.post<Wrapped<StudentDocument>>(
    `/teacher/students/${studentId}/grades`,
    {
      school_year_id: schoolYearId,
      semester,
      key: signed.key,
      file_name: file.name,
      size: file.size,
      content_type: file.type,
    },
  );

  return data.data;
}
