import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/features/auth/store';
import type { ReturnRequirements } from '@/features/bills/types';

export interface StudentReturnSummary {
  state: 'not_applicable' | 'unavailable' | 'settlement_required' | 'ready' | 'pending' | 'enrolled' | 'blocked';
  canStart: boolean;
  blockers: string[];
  effectiveDroppingDate: string | null;
  returnDeadline: string | null;
  source: { id: number; schoolYear: string; program: string; programName: string; yearLevel: string; droppingRequestId: number | null; billId: number | null } | null;
  offer: { schoolYearId: number; schoolYear: string; feeTotal: number; downpaymentType: 'fixed' | 'percentage'; downpaymentValue: number } | null;
  enrollment: { id: number; schoolYear: string; status: string; billId: number | null; program: string; programName: string; yearLevel: string } | null;
  requirements: ReturnRequirements | null;
  previousBills: { id: number; schoolYear: string; balance: number; pendingPayment: number }[];
  availableCredit: number;
}
export const returnQueryKey = ['me', 're-enrollment'] as const;
export function useStudentReturn() {
  const user = useAuthStore(state => state.user);
  return useQuery({
    queryKey: [...returnQueryKey, user?.id],
    enabled: user?.role === 'student',
    queryFn: async () => (await api.get<{data: StudentReturnSummary}>('/me/re-enrollment')).data.data,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: query => ['pending', 'settlement_required'].includes(query.state.data?.state ?? '') ? 30_000 : false,
  });
}
export async function startStudentReturn(schoolYearId: number) {
  return (await api.post('/me/re-enrollment', {schoolYearId})).data.data;
}
