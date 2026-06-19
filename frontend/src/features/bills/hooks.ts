import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBills, fetchStudentBill, generateBills } from "./api";

export const billsQueryKey = ["admin", "bills"] as const;

export function useBills() {
  return useQuery({
    queryKey: billsQueryKey,
    queryFn: fetchBills,
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
