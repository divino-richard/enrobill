import api from "@/lib/api";
import type { Bill } from "./types";

interface Wrapped<T> {
  data: T;
}

// Bills for the currently open term (admin).
export async function fetchBills(): Promise<Bill[]> {
  const { data } = await api.get<Wrapped<Bill[]>>("/admin/bills");
  return data.data;
}

// Bulk-generate bills for all eligible admitted students in the open term.
export async function generateBills(): Promise<{ created: number }> {
  const { data } = await api.post<{ created: number }>(
    "/admin/bills/generate",
  );
  return data;
}

// A single student's bill for the open term (404 if not billed yet).
export async function fetchStudentBill(studentId: number): Promise<Bill> {
  const { data } = await api.get<Wrapped<Bill>>(
    `/admin/students/${studentId}/bill`,
  );
  return data.data;
}
