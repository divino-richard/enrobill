import api from "@/lib/api";
import type { Student, StudentFormValues } from "./types";

interface Wrapped<T> {
  data: T;
}

export interface StudentListParams {
  page?: number;
  perPage?: number;
  sort?: string;
  dir?: "asc" | "desc";
  status?: string;
  search?: string;
}

export interface PageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface StudentsPage {
  rows: Student[];
  meta: PageMeta;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

// Paginated / searchable / sortable list of students (admin only).
export async function fetchStudents(
  params: StudentListParams,
): Promise<StudentsPage> {
  const { data } = await api.get<PaginatedResponse<Student>>("/admin/students", {
    params: {
      page: params.page,
      per_page: params.perPage,
      sort: params.sort,
      dir: params.dir,
      status: params.status,
      search: params.search,
    },
  });

  return {
    rows: data.data,
    meta: {
      currentPage: data.meta.current_page,
      lastPage: data.meta.last_page,
      perPage: data.meta.per_page,
      total: data.meta.total,
      from: data.meta.from,
      to: data.meta.to,
    },
  };
}

// A single student record (admin only).
export async function fetchStudent(id: number): Promise<Student> {
  const { data } = await api.get<Wrapped<Student>>(`/admin/students/${id}`);
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
