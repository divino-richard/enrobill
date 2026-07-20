// Clearance and grade slips a student uploads once per semester. The school year
// itself has no semester column, so the semester is carried on the document.
export type Semester = "first" | "second";
export type StudentDocumentType = "clearance" | "grades";

export interface StudentDocument {
  id: number;
  semester: Semester;
  type: StudentDocumentType;
  fileName: string;
  size: number | null;
  contentType: string | null;
  uploadedAt: string | null;
}

export const SEMESTERS: { value: Semester; label: string }[] = [
  { value: "first", label: "1st Semester" },
  { value: "second", label: "2nd Semester" },
];

export const DOCUMENT_TYPES: {
  value: StudentDocumentType;
  label: string;
  hint: string;
}[] = [
  {
    value: "clearance",
    label: "Clearance",
    hint: "Signed clearance for the semester",
  },
  {
    value: "grades",
    label: "Grades",
    hint: "Report card or grade slip",
  },
];

export function semesterLabel(semester: string): string {
  return SEMESTERS.find((s) => s.value === semester)?.label ?? semester;
}

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// Mirrors the backend's accepted MIME types and size cap.
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "application/pdf"];
export const ACCEPT_ATTR = ".jpg,.jpeg,.png,.pdf";
export const MAX_BYTES = 10 * 1024 * 1024;
