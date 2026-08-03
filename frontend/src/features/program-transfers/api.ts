import api from "@/lib/api";
import type {
  TransferDecisionInput,
  TransferRequest,
  TransferRequestInput,
} from "./types";

interface Wrapped<T> {
  data: T;
}

// The authenticated student's own transfer requests.
export async function fetchMyTransferRequests(): Promise<TransferRequest[]> {
  const { data } = await api.get<Wrapped<TransferRequest[]>>(
    "/me/transfer-requests",
  );
  return data.data;
}

export async function submitTransferRequest(
  input: TransferRequestInput,
): Promise<TransferRequest> {
  const { data } = await api.post<Wrapped<TransferRequest>>(
    "/me/transfer-requests",
    input,
  );
  return data.data;
}

// Every transfer request, for the admin list.
export async function fetchAdminTransferRequests(): Promise<TransferRequest[]> {
  const { data } = await api.get<Wrapped<TransferRequest[]>>(
    "/admin/transfer-requests",
  );
  return data.data;
}

export async function decideTransferRequest(
  id: number,
  input: TransferDecisionInput,
): Promise<TransferRequest> {
  const { data } = await api.post<Wrapped<TransferRequest>>(
    `/admin/transfer-requests/${id}/decide`,
    input,
  );
  return data.data;
}
