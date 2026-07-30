export type TransferRequestStatus = "pending" | "approved" | "rejected";

export interface TransferRequest {
  id: number;
  studentId: number;
  studentName: string;
  studentNumber: string;
  fromProgramCode: string;
  fromProgramName: string;
  toProgramCode: string;
  toProgramName: string;
  reason: string;
  status: TransferRequestStatus;
  requestedAt: string; // ISO timestamp
  decidedAt: string | null;
  decisionNote: string | null;
}

interface StatusMeta {
  label: string;
  // Soft badge colours per status.
  className: string;
}

export const TRANSFER_STATUS_META: Record<TransferRequestStatus, StatusMeta> = {
  pending: {
    label: "Pending",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  approved: {
    label: "Approved",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  },
};
