import api from '@/lib/api';

export type DroppingCategory = 'paying' | 'voucher_esc';
export type DroppingComponent = 'registration' | 'miscellaneous' | 'laboratory' | 'tuition' | 'other';
export const COMPONENTS: { value: DroppingComponent; label: string }[] = [
  { value: 'registration', label: 'Registration' }, { value: 'miscellaneous', label: 'Miscellaneous' },
  { value: 'laboratory', label: 'Laboratory' }, { value: 'tuition', label: 'Tuition' }, { value: 'other', label: 'Other' },
];
export const PERIODS = [
  { key: 'enrollment', label: 'Enrollment period', paying: 'Registration', voucher: 'Registration' },
  { key: 'quarter_1', label: 'First quarter', paying: 'Miscellaneous + laboratory', voucher: '50% of miscellaneous' },
  { key: 'quarter_2', label: 'Second quarter', paying: 'Miscellaneous + laboratory + 50% of tuition', voucher: 'Full miscellaneous' },
  { key: 'quarter_3', label: 'Third quarter', paying: 'Total assessment', voucher: 'Miscellaneous + laboratory' },
  { key: 'quarter_4', label: 'Final quarter', paying: 'Total assessment', voucher: '50% of total assessment' },
] as const;
export type PeriodKey = typeof PERIODS[number]['key'];
export interface DroppingAssessment {
  ready: boolean; issues: string[]; fingerprint: string | null; policyVersion: number | null;
  period: PeriodKey | null; category: DroppingCategory | null; effectiveDate: string;
  originalTotal: number; finalCharge: number | null; verifiedPayments: number; balance: number; credit: number | null;
  feeBreakdown: Partial<Record<DroppingComponent, number>>; finalized?: boolean; legacy?: boolean; creditApplied?: number;
}
export interface DroppingPolicy {
  id?: number; schoolYearId: number; version: number; enabled: boolean;
  periods: Record<PeriodKey, { startsOn: string; endsOn: string }>;
}
export interface ReturningSummary {
  previousBalance: number; availableCredit: number; eligible: boolean; blockers: string[];
  latestSchoolYearId: number | null; latestSchoolYear: string | null;
}
export interface ReturningInput {
  schoolYearId: number; program: string; yearLevel: string; discountId: number | null; droppingCategory: DroppingCategory;
}
export interface PaymentArrangement {
  remarks: string; installments: { dueDate: string; amount: number }[];
  approvedBy?: number | string; createdAt?: string;
}
export async function fetchAssessment(id: number, effectiveDate: string) {
  return (await api.get<{ data: DroppingAssessment }>(`/dropping-requests/${id}/assessment`, { params: { effectiveDate } })).data.data;
}
export async function fetchPolicy(id: number) {
  return (await api.get<{ data: DroppingPolicy | null }>(`/admin/school-years/${id}/dropping-policy`)).data.data;
}
export async function savePolicy(id: number, input: Pick<DroppingPolicy, 'enabled' | 'periods'>) {
  return (await api.put(`/admin/school-years/${id}/dropping-policy`, input)).data;
}
export async function saveClassification(id: number, items: { id: number; component: DroppingComponent }[]) {
  return (await api.put(`/admin/bills/${id}/dropping-classification`, { items })).data;
}
export async function saveCategory(id: number, category: DroppingCategory) {
  return (await api.put(`/admin/enrollments/${id}/dropping-category`, { category })).data;
}
export async function fetchReturningSummary(id: number) {
  return (await api.get<{ data: ReturningSummary }>(`/admin/students/${id}/returning-summary`)).data.data;
}
export async function createReturningEnrollment(id: number, input: ReturningInput) {
  return (await api.post(`/admin/students/${id}/returning-enrollments`, input)).data;
}
export async function saveArrangement(id: number, input: PaymentArrangement) {
  return (await api.put(`/admin/bills/${id}/payment-arrangement`, input)).data;
}
export const philippinesToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
