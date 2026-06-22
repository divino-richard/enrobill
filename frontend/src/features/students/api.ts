import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type {
  AdmitStudentValues,
  EnrollmentRecord,
  EnrollmentStatus,
  Student,
  StudentFormValues,
} from "./types";

interface Wrapped<T> {
  data: T;
}

export type StudentListParams = ListParams;

export interface StudentsPage {
  rows: Student[];
  meta: PageMeta;
}

// Paginated / searchable / sortable list of students (admin only).
export async function fetchStudents(
  params: StudentListParams,
): Promise<StudentsPage> {
  const { data } = await api.get<LaravelPaginated<Student>>("/admin/students", {
    params: listParamsToQuery(params),
  });

  return { rows: data.data, meta: toPageMeta(data.meta) };
}

// A single student record (admin only).
export async function fetchStudent(id: number): Promise<Student> {
  const { data } = await api.get<Wrapped<Student>>(`/admin/students/${id}`);
  return data.data;
}

// The authenticated user's own student record (404 if not a student yet).
export async function fetchMyStudent(): Promise<Student> {
  const { data } = await api.get<Wrapped<Student>>("/me/student");
  return data.data;
}

// The authenticated student's per-term enrollment history.
export async function fetchMyEnrollments(): Promise<EnrollmentRecord[]> {
  const { data } = await api.get<Wrapped<EnrollmentRecord[]>>(
    "/me/enrollments",
  );
  return data.data;
}

// Admit a walk-in student directly — creates their account + student record.
export async function admitStudent(
  values: AdmitStudentValues,
): Promise<Student> {
  const { data } = await api.post<Wrapped<Student>>("/admin/students", {
    email: values.email,
    password: values.password,
    password_confirmation: values.passwordConfirmation,
    firstName: values.firstName,
    middleName: values.middleName || null,
    lastName: values.lastName,
    trackOrStrand: values.trackOrStrand,
    yearLevel: values.yearLevel,
    schoolYear: values.schoolYear,
    noDownpayment: values.noDownpayment,
  });
  return data.data;
}

// A student's per-term enrollments (admin only).
export async function fetchStudentEnrollments(
  studentId: number,
): Promise<EnrollmentRecord[]> {
  const { data } = await api.get<Wrapped<EnrollmentRecord[]>>(
    `/admin/students/${studentId}/enrollments`,
  );
  return data.data;
}

// Update an enrollment's status (admin only).
export async function updateEnrollmentStatus(
  enrollmentId: number,
  status: EnrollmentStatus,
): Promise<EnrollmentRecord> {
  const { data } = await api.put<Wrapped<EnrollmentRecord>>(
    `/admin/enrollments/${enrollmentId}`,
    { status },
  );
  return data.data;
}

// Update a student record (admin only).
export async function updateStudent(
  id: number,
  values: StudentFormValues,
): Promise<Student> {
  const { data } = await api.put<Wrapped<Student>>(
    `/admin/students/${id}`,
    values,
  );
  return data.data;
}
