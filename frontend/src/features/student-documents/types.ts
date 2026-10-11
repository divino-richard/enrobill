// Clearance and grade slips a student uploads once per semester. The school year
// itself has no semester column, so the semester is carried on the document.
export type Semester = "first" | "second";
export type StudentDocumentType = "clearance" | "grades";

// Where a document stands with the registrar. "returned" means it was
// reviewed and sent back with a reason — the only status besides "pending"
// that lets the student replace or remove the file.
export type ReviewStatus = "pending" | "accepted" | "returned";

export interface StudentDocument {
  schoolYear?: string | null;
  id: number;
  semester: Semester;
  type: StudentDocumentType;
  fileName: string;
  size: number | null;
  contentType: string | null;
  uploadedAt: string | null;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
}

export const REVIEW_STATUS_META: Record<
  ReviewStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Submitted",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  accepted: {
    label: "Accepted",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  returned: {
    label: "Returned",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
};

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
    hint: "Your teacher uploads this grade slip",
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
