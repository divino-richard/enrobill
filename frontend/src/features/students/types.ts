export type StudentStatus =
  | "admitted"
  | "enrolled"
  | "inactive"
  | "graduated"
  | "dropped";

export interface Student {
  id: number;
  studentNumber: string;
  status: StudentStatus;
  firstName: string;
  middleName: string | null;
  lastName: string;
  extension: string | null;
  dateOfBirth: string | null; // 'yyyy-MM-dd'
  gender: string | null;
  nationality: string | null;
  civilStatus: string | null;
  placeOfBirth: string | null;
  religion: string | null;
  email: string | null;
  phoneNumber: string | null;
  addressProvince: string | null;
  addressCity: string | null;
  addressBarangay: string | null;
  addressStreet: string | null;
  trackOrStrand: string | null;
  yearLevel: string | null;
  schoolYear: string | null;
  applicationId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// Editable fields sent to the update endpoint (camelCase, all strings).
export interface StudentFormValues {
  firstName: string;
  middleName: string;
  lastName: string;
  extension: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  civilStatus: string;
  placeOfBirth: string;
  religion: string;
  email: string;
  phoneNumber: string;
  addressProvince: string;
  addressCity: string;
  addressBarangay: string;
  addressStreet: string;
  trackOrStrand: string;
  yearLevel: string;
  schoolYear: string;
  status: StudentStatus;
}

export const STUDENT_STATUS_OPTIONS = [
  { value: "admitted", label: "Admitted" },
  { value: "enrolled", label: "Enrolled" },
  { value: "inactive", label: "Inactive" },
  { value: "graduated", label: "Graduated" },
  { value: "dropped", label: "Dropped" },
] as const;

// Soft badge colours per student status.
export const STUDENT_STATUS_META: Record<
  StudentStatus,
  { label: string; className: string }
> = {
  admitted: {
    label: "Admitted",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  enrolled: {
    label: "Enrolled",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  inactive: {
    label: "Inactive",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
  },
  graduated: {
    label: "Graduated",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  },
  dropped: {
    label: "Dropped",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  },
};

// Map a fetched Student to the editable form values (nulls → empty strings).
export function studentToFormValues(student: Student): StudentFormValues {
  return {
    firstName: student.firstName ?? "",
    middleName: student.middleName ?? "",
    lastName: student.lastName ?? "",
    extension: student.extension ?? "",
    dateOfBirth: student.dateOfBirth ?? "",
    gender: student.gender ?? "",
    nationality: student.nationality ?? "",
    civilStatus: student.civilStatus ?? "",
    placeOfBirth: student.placeOfBirth ?? "",
    religion: student.religion ?? "",
    email: student.email ?? "",
    phoneNumber: student.phoneNumber ?? "",
    addressProvince: student.addressProvince ?? "",
    addressCity: student.addressCity ?? "",
    addressBarangay: student.addressBarangay ?? "",
    addressStreet: student.addressStreet ?? "",
    trackOrStrand: student.trackOrStrand ?? "",
    yearLevel: student.yearLevel ?? "",
    schoolYear: student.schoolYear ?? "",
    status: student.status,
  };
}

export function studentFullName(student: Student): string {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");
}
