import axios from 'axios';
import api from '@/lib/api';
import type { DroppingAssessment, DroppingCategory } from '@/features/dropping-finance/api';

export type DropStatus = 'draft' | 'submitted' | 'needs_correction' | 'confirmed' | 'rejected' | 'cancelled';
export const STATUS_LABELS: Record<DropStatus, string> = {
  draft: 'Draft', submitted: 'Waiting for approval', needs_correction: 'Changes requested', confirmed: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
};
export interface DroppingRequest {
  droppingCategory: DroppingCategory | null; droppingAssessment: DroppingAssessment | null;
  id: number; packetVersion: number; reference: string; enrollmentId: number; studentId: number; status: DropStatus;
  snapshot: { studentName: string; studentNumber: string; schoolYear: string; program: string; yearLevel: string; initiatedBy?: 'admin' };
  financialSummary: { verifiedPayments: number; balance: number; creditApplied: number; creditIssued: number; availableCredit: number } | null;
  reason: string | null; balance: number; billId: number | null;
  submissions: { version: number; submittedAt: string; reason: string; files: { id: string; name: string; mime: string; size: number }[] }[];
  events: { action: string; actorId: number; actorName: string; actorRole?: string; at: string; remarks: string | null }[];
  effectiveDate: string | null; confirmedAt: string | null; finalRemarks: string | null; createdAt: string;
}
export async function fetchDroppingRequests(staff: boolean) {
  return (await api.get<{ data: DroppingRequest[] }>(staff ? '/admin/dropping-requests' : '/me/dropping-requests')).data.data;
}
export async function fetchDroppingRequest(id: number) {
  return (await api.get<{ data: DroppingRequest }>(`/dropping-requests/${id}`)).data.data;
}
export interface DroppingSubmission {
  reason: string;
  files: File[];
}

interface SignedDroppingUpload {
  key: string;
  url: string;
}

export async function submitDroppingRequest({ enrollmentId, requestId, reason, files }: DroppingSubmission & {
  enrollmentId: number;
  requestId?: number;
}): Promise<DroppingRequest> {
  const uploadsPath = '/me/dropping-requests/uploads';
  const startError = 'We could not start the document upload. Please try again. If this continues, contact the school for help.';
  const metadata = files.map(file => ({ name: file.name, mime: file.type, size: file.size }));
  let signed: SignedDroppingUpload[];
  try {
    const response = await api.post<{ data: SignedDroppingUpload[] }>(`${uploadsPath}/presign`, { enrollmentId, files: metadata });
    signed = response.data?.data;
    if (!Array.isArray(signed) || signed.length !== files.length || signed.some(upload => !upload?.url || !upload.key)) {
      throw new Error(startError);
    }
  } catch (error) {
    if (axios.isAxiosError(error) && (!error.response || error.response.status >= 500)) {
      throw new Error(startError, { cause: error });
    }
    throw error;
  }

  let submissionStarted = false;
  try {
    for (const [index, file] of files.entries()) {
      try {
        // The bare client keeps the API access token off the signed S3 request.
        await axios.put(signed[index].url, file, { headers: { 'Content-Type': file.type } });
      } catch (error) {
        throw new Error(`Document ${index + 1} could not be uploaded. Check your connection and try again. If this continues, contact the school for help.`, { cause: error });
      }
    }
    const path = requestId === undefined ? '/me/dropping-requests' : `/me/dropping-requests/${requestId}/submit`;
    submissionStarted = true;
    const response = await api.post<{ data: DroppingRequest }>(path, {
      enrollmentId, reason, files: metadata.map((file, index) => ({ ...file, key: signed[index].key })),
    });
    return response.data.data;
  } catch (error) {
    const rejected = axios.isAxiosError(error) && error.response
      && error.response.status >= 400 && error.response.status < 500;
    // The server cleans up after commit. An uncertain submission may still be using these keys.
    if (!submissionStarted || rejected) {
      await api.delete(uploadsPath, {
        data: { enrollmentId, keys: signed.map(upload => upload.key) },
        timeout: 5000,
      }).catch(() => {});
    }
    throw error;
  }
}
export type AdminDroppingInput = {
  enrollmentId: number; reason: string; effectiveDate: string; assessmentFingerprint: string; confirmed: true;
};
export async function fetchAdminDroppingAssessment(studentId: number, enrollmentId: number, effectiveDate: string) {
  return (await api.get<{ data: { assessment: DroppingAssessment; billId: number | null } }>(`/admin/students/${studentId}/dropping-assessment`, { params: { enrollmentId, effectiveDate } })).data.data;
}
export async function createAdminDroppingRequest(studentId: number, payload: AdminDroppingInput) {
  return (await api.post<{ data: DroppingRequest }>(`/admin/students/${studentId}/dropping-requests`, payload)).data.data;
}
export async function droppingAction(id: number, action: string, staff: boolean, payload: Record<string, unknown> = {}) {
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
