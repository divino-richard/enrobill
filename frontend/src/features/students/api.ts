import api from "@/lib/api";
import type { Student, StudentFormValues } from "./types";

interface Wrapped<T> {
  data: T;
}

// All students (admin only).
export async function fetchStudents(): Promise<Student[]> {
  const { data } = await api.get<Wrapped<Student[]>>("/admin/students");
  return data.data;
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
