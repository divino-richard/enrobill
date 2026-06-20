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
