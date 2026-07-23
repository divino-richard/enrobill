import axios from "axios";
import api from "@/lib/api";
import type { PaymentChannel } from "./types";

interface Wrapped<T> {
  data: T;
}

interface PresignResponse {
  key: string;
  url: string;
  headers: Record<string, string | string[]>;
}

// All channels, for admin management.
export async function fetchAdminPaymentChannels(): Promise<PaymentChannel[]> {
  const { data } = await api.get<Wrapped<PaymentChannel[]>>(
    "/admin/payment-channels",
  );
  return data.data;
}

// Active channels with a QR set, for students to pay against.
export async function fetchActivePaymentChannels(): Promise<PaymentChannel[]> {
  const { data } = await api.get<Wrapped<PaymentChannel[]>>(
    "/payment-channels",
  );
  return data.data;
}

export interface PaymentChannelInput {
  accountName: string | null;
  accountNumber: string | null;
  isActive: boolean;
  qrKey?: string | null;
}

// A new payment method. The QR is added afterwards via update, since presigning
// the upload needs a saved channel id.
export interface PaymentChannelCreateInput {
  label: string;
  accountName: string | null;
  accountNumber: string | null;
  isActive: boolean;
}

export async function createPaymentChannel(
  input: PaymentChannelCreateInput,
): Promise<PaymentChannel> {
  const { data } = await api.post<Wrapped<PaymentChannel>>(
    "/admin/payment-channels",
    input,
  );
  return data.data;
}

export async function updatePaymentChannel(
  id: number,
  input: PaymentChannelInput,
): Promise<PaymentChannel> {
  const { data } = await api.put<Wrapped<PaymentChannel>>(
    `/admin/payment-channels/${id}`,
    input,
  );
  return data.data;
}

// Remove a payment method entirely. Refused by the API once payments have been
// recorded against it.
export async function deletePaymentChannel(id: number): Promise<void> {
  await api.delete(`/admin/payment-channels/${id}`);
}

// Presign + upload a QR image straight to S3; returns the stored object key.
export async function uploadPaymentChannelQr(
  id: number,
  file: File,
): Promise<string> {
  const { data } = await api.post<PresignResponse>(
    `/admin/payment-channels/${id}/presign`,
    { contentType: file.type, size: file.size },
  );

  await axios.put(data.url, file, {
    headers: { "Content-Type": file.type },
  });

  return data.key;
}
