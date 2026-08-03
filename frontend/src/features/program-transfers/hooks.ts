import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideTransferRequest,
  fetchAdminTransferRequests,
  fetchMyTransferRequests,
  submitTransferRequest,
} from "./api";
import type { TransferDecisionInput, TransferRequestInput } from "./types";

export const myTransferRequestsQueryKey = ["me", "transfer-requests"] as const;
export const adminTransferRequestsQueryKey = [
  "admin",
  "transfer-requests",
] as const;

export function useMyTransferRequests() {
  return useQuery({
    queryKey: myTransferRequestsQueryKey,
    queryFn: fetchMyTransferRequests,
  });
}

export function useSubmitTransferRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransferRequestInput) => submitTransferRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myTransferRequestsQueryKey });
    },
  });
}

// `enabled` defaults to true; pass `role === "admin"` from callers (like the
// sidebar) that also render for roles this endpoint 403s for.
export function useAdminTransferRequests(enabled = true) {
  return useQuery({
    queryKey: adminTransferRequestsQueryKey,
    queryFn: fetchAdminTransferRequests,
    enabled,
  });
}

export function useDecideTransferRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: TransferDecisionInput & { id: number }) =>
      decideTransferRequest(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTransferRequestsQueryKey });
      // Approving actually moves the student — their program/section changed.
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "enrollments"] });
    },
  });
}

// Sidebar badge count — shares the cached admin list rather than firing a
// second request when the admin page itself is also mounted.
export function usePendingTransferCount(enabled = true) {
  const { data } = useAdminTransferRequests(enabled);
  return data?.filter((request) => request.status === "pending").length ?? 0;
}
