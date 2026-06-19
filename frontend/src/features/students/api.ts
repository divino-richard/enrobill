import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type { Student, StudentFormValues } from "./types";

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
