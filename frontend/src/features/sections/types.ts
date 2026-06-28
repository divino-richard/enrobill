// A student placed in a section (via their enrollment).
export interface SectionStudent {
  enrollmentId: number;
  studentId: number;
  studentNumber: string | null;
  name: string;
  status: string;
}

// A class section: a managed bucket scoped to a school year, program and grade.
export interface Section {
  id: number;
  schoolYearId: number;
  program: string;
  yearLevel: string;
  name: string;
  capacity: number;
  assignedCount: number;
  students: SectionStudent[];
}

// An enrolled student not yet placed in a section.
export interface UnsectionedStudent {
  enrollmentId: number;
  studentId: number;
  studentNumber: string | null;
  name: string;
  program: string | null;
  yearLevel: string | null;
}

export interface SectionFilters {
  schoolYearId?: number;
  program?: string;
  yearLevel?: string;
}

export interface SectionInput {
  schoolYearId: number;
  program: string;
  yearLevel: string;
  name: string;
  capacity: number;
}

export interface SectionUpdateInput {
  name: string;
  capacity: number;
}
