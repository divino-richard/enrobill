import type { StudentDocument } from "@/features/student-documents/types";

export interface TeacherGradeStudent {
  id: number;
  studentNumber: string;
  name: string;
  documents: StudentDocument[];
}

export interface TeacherGradeSection {
  id: number;
  name: string;
  program: string;
  yearLevel: string;
  students: TeacherGradeStudent[];
}

export interface TeacherGradesData {
  schoolYearId: number;
  schoolYear: string;
  schoolYears: Array<{
    id: number;
    schoolYear: string;
    isActive: boolean;
  }>;
  sections: TeacherGradeSection[];
}
