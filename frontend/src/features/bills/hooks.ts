import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  applyAdjustment,
  fetchBill,
  fetchBills,
  fetchStudentBill,
  generateBills,
  fetchMyBill,
  fetchMyBills,
  recordPayment,
  rejectPayment,
  removeAdjustment,
  submitMyPayment,
  verifyPayment,
  voidPayment,
  type BillListParams,
  type PaymentInput,
  type SubmitPaymentInput,
} from "./api";
import type { Bill } from "./types";

export const billsQueryKey = ["admin", "bills"] as const;

export function useBills(params: BillListParams) {
  return useQuery({
    queryKey: [...billsQueryKey, "list", params],
    queryFn: () => fetchBills(params),
    placeholderData: keepPreviousData,
  });
}

export function useGenerateBills() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateBills,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billsQueryKey });
      // Per-student bill queries live under ["admin","students",id,"bill"].
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
  });
}

export function useStudentBill(studentId: number) {
  return useQuery({
    queryKey: ["admin", "students", studentId, "bill"],
    queryFn: () => fetchStudentBill(studentId),
    // A 404 just means "not billed yet" — don't retry it.
    retry: false,
  });
}

export const billQueryKey = (billId: number) =>
  ["admin", "bills", "detail", billId] as const;

export function useBill(billId: number) {
  return useQuery({
    queryKey: billQueryKey(billId),
    queryFn: () => fetchBill(billId),
  });
}

// Shared cache update for every mutation that returns the fresh bill: refresh
// the detail view, the bills list, and any per-student bill card.
function useBillMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<Bill>,
  billId: number,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (bill) => {
      queryClient.setQueryData(billQueryKey(billId), bill);
      queryClient.invalidateQueries({ queryKey: billsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
  });
}

export function useApplyAdjustment(billId: number) {
  return useBillMutation(
    (discountId: number) => applyAdjustment(billId, discountId),
    billId,
  );
}

export function useRemoveAdjustment(billId: number) {
  return useBillMutation(
    (adjustmentId: number) => removeAdjustment(billId, adjustmentId),
    billId,
  );
}

export function useRecordPayment(billId: number) {
  return useBillMutation(
    (input: PaymentInput) => recordPayment(billId, input),
    billId,
  );
}

export function useVoidPayment(billId: number) {
  return useBillMutation(
    (paymentId: number) => voidPayment(billId, paymentId),
    billId,
  );
}

export function useVerifyPayment(billId: number) {
  return useBillMutation(
    (paymentId: number) => verifyPayment(billId, paymentId),
    billId,
  );
}

export function useRejectPayment(billId: number) {
  return useBillMutation(
    (paymentId: number) => rejectPayment(billId, paymentId),
    billId,
  );
}

// --- Student self-service ---------------------------------------------------

export const myBillQueryKey = ["me", "bill"] as const;

export function useMyBill() {
  return useQuery({
    queryKey: myBillQueryKey,
    queryFn: fetchMyBill,
    // A 404 means "no bill yet" — don't retry.
    retry: false,
  });
}

export const myBillsQueryKey = ["me", "bills"] as const;

export function useMyBills() {
  return useQuery({
    queryKey: myBillsQueryKey,
    queryFn: fetchMyBills,
    retry: false,
  });
}

export function useSubmitMyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitPaymentInput) => submitMyPayment(input),
    onSuccess: (bill) => {
      queryClient.setQueryData(myBillQueryKey, bill);
    },
  });
}

