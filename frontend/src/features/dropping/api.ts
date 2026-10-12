import api from '@/lib/api';
import type { DroppingAssessment, DroppingCategory } from '@/features/dropping-finance/api';

export type DropStatus = 'draft' | 'submitted' | 'needs_correction' | 'confirmed' | 'rejected' | 'cancelled';
export const STATUS_LABELS: Record<DropStatus, string> = {
  draft: 'Draft', submitted: 'Waiting for approval', needs_correction: 'Changes requested', confirmed: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
};
export interface DroppingRequest {
  droppingCategory: DroppingCategory | null; droppingAssessment: DroppingAssessment | null;
  id: number; packetVersion: number; reference: string; enrollmentId: number; studentId: number; status: DropStatus;
  snapshot: { studentName: string; studentNumber: string; schoolYear: string; program: string; yearLevel: string };
  financialSummary: { verifiedPayments: number; balance: number; creditApplied: number; creditIssued: number; availableCredit: number } | null;
  reason: string | null; balance: number; billId: number | null;
  submissions: { version: number; submittedAt: string; reason: string; files: { id: string; name: string; mime: string; size: number }[] }[];
  events: { action: string; actorId: number; actorName: string; at: string; remarks: string | null }[];
  effectiveDate: string | null; confirmedAt: string | null; finalRemarks: string | null; createdAt: string;
}
export async function fetchDroppingRequests(staff: boolean) {
  return (await api.get<{ data: DroppingRequest[] }>(staff ? '/admin/dropping-requests' : '/me/dropping-requests')).data.data;
}
export async function fetchDroppingRequest(id: number) {
  return (await api.get<{ data: DroppingRequest }>(`/dropping-requests/${id}`)).data.data;
}
export async function createDroppingRequest(payload: FormData) {
  return (await api.post<{ data: DroppingRequest }>('/me/dropping-requests', payload)).data.data;
}
export async function droppingAction(id: number, action: string, staff: boolean, payload: Record<string, unknown> | FormData = {}) {
  return (await api.post<{ data: DroppingRequest }>(`/${staff ? 'admin' : 'me'}/dropping-requests/${id}/${action}`, payload)).data.data;
}
export async function droppingBlob(path: string) {
  return (await api.get<Blob>(path, { responseType: 'blob' })).data;
}
export async function downloadDroppingFile(path: string, name: string) {
  const url = URL.createObjectURL(await droppingBlob(path));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
