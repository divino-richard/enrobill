import axios from "axios";
import api from "@/lib/api";
import {
  listParamsToQuery,
  toPageMeta,
  type LaravelPaginated,
  type ListParams,
  type PageMeta,
} from "@/lib/pagination";
import type { Bill, PaymentMethod, PaymentOption } from "./types";

interface Wrapped<T> {
  data: T;
}

interface PresignResponse {
  key: string;
  url: string;
  headers: Record<string, string | string[]>;
}

export type BillListParams = ListParams;

export interface BillsPage {
  rows: Bill[];
  meta: PageMeta;
}

// Paginated / searchable / sortable bills for the open term (admin).
export async function fetchBills(params: BillListParams): Promise<BillsPage> {
  const { data } = await api.get<LaravelPaginated<Bill>>("/admin/bills", {
    params: listParamsToQuery(params),
  });
  return { rows: data.data, meta: toPageMeta(data.meta) };
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

// A single bill with its items, credits, installment plan and payments.
export async function fetchBill(billId: number): Promise<Bill> {
  const { data } = await api.get<Wrapped<Bill>>(`/admin/bills/${billId}`);
  return data.data;
}

// Apply a catalog discount to a bill.
export async function applyAdjustment(
  billId: number,
  discountId: number,
): Promise<Bill> {
  const { data } = await api.post<Wrapped<Bill>>(
    `/admin/bills/${billId}/adjustments`,
    { discountId },
  );
  return data.data;
}

// Remove an applied discount from a bill.
export async function removeAdjustment(
  billId: number,
  adjustmentId: number,
): Promise<Bill> {
  const { data } = await api.delete<Wrapped<Bill>>(
    `/admin/bills/${billId}/adjustments/${adjustmentId}`,
  );
  return data.data;
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  paidAt: string;
  note?: string | null;
}

// Record a payment against a bill.
export async function recordPayment(
  billId: number,
  input: PaymentInput,
): Promise<Bill> {
  const { data } = await api.post<Wrapped<Bill>>(
    `/admin/bills/${billId}/payments`,
    input,
  );
  return data.data;
}

// Void a recorded payment.
export async function voidPayment(
  billId: number,
  paymentId: number,
): Promise<Bill> {
  const { data } = await api.delete<Wrapped<Bill>>(
    `/admin/bills/${billId}/payments/${paymentId}`,
  );
  return data.data;
}

// --- Student self-service (portal) -----------------------------------------

// The authenticated student's bill for the open term (404 if none).
export async function fetchMyBill(): Promise<Bill> {
  const { data } = await api.get<Wrapped<Bill>>("/me/bill");
  return data.data;
}

// All of the student's bills across terms (current + history), newest first.
export async function fetchMyBills(): Promise<Bill[]> {
  const { data } = await api.get<Wrapped<Bill[]>>("/me/bills");
  return data.data;
}

// Choose how to pay: full or installment (generates the schedule).
export async function chooseMyPlan(option: PaymentOption): Promise<Bill> {
  const { data } = await api.put<Wrapped<Bill>>("/me/bill/payment-option", {
    option,
  });
  return data.data;
}

// Presign + upload a proof-of-payment screenshot; returns the object key.
export async function uploadPaymentProof(file: File): Promise<string> {
  const { data } = await api.post<PresignResponse>(
    "/me/bill/payments/presign",
    { contentType: file.type, size: file.size },
  );

  await axios.put(data.url, file, {
    headers: { "Content-Type": file.type },
  });

  return data.key;
}

export interface SubmitPaymentInput {
  // The amount is set server-side (next installment, else balance).
  method: PaymentMethod;
  reference?: string | null;
  proofKey: string;
  paidAt: string;
  note?: string | null;
}

// Submit a payment for admin verification.
export async function submitMyPayment(
  input: SubmitPaymentInput,
): Promise<Bill> {
  const { data } = await api.post<Wrapped<Bill>>("/me/bill/payments", input);
  return data.data;
}

// Verify a student-submitted (pending) payment so it counts.
export async function verifyPayment(
  billId: number,
  paymentId: number,
): Promise<Bill> {
  const { data } = await api.post<Wrapped<Bill>>(
    `/admin/bills/${billId}/payments/${paymentId}/verify`,
  );
  return data.data;
}

// Reject a student-submitted payment.
export async function rejectPayment(
  billId: number,
  paymentId: number,
): Promise<Bill> {
  const { data } = await api.post<Wrapped<Bill>>(
    `/admin/bills/${billId}/payments/${paymentId}/reject`,
  );
  return data.data;
}
