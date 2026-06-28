export type EnrollmentStatus =
  | "pending"
  | "enrolled"
  | "dropped"
  | "completed"
  | "withdrawn";

export type EnrollmentBillStatus = "unpaid" | "partial" | "paid";

export interface EnrollmentStudent {
  id: number | null;
  name: string;
  studentNumber: string | null;
  track: string | null;
  yearLevel: string | null;
}

export interface EnrollmentOpenBill {
  id: number;
  schoolYear: string | null;
  status: EnrollmentBillStatus;
  balance: number;
  isCurrent: boolean;
}

// An enrollment row in the global (read-only) list.
export interface Enrollment {
  id: number;
  schoolYear: string | null;
  semester: string | null;
  program: string | null;
  yearLevel: string | null;
  noDownpayment: boolean;
  status: EnrollmentStatus;
  enrolledAt: string | null;
  isCurrent: boolean;
  hasBill: boolean | null;
  feePreview: number | null;
  openBillCount?: number | null;
  openBillTotal?: number | null;
  openBills?: EnrollmentOpenBill[] | null;
  student: EnrollmentStudent | null;
}

export const ENROLLMENT_STATUS_META: Record<
  EnrollmentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  enrolled: {
    label: "Enrolled",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  completed: {
    label: "Completed",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  },
  dropped: {
    label: "Dropped",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  },
  withdrawn: {
    label: "Withdrawn",
    className:
      "border-border bg-muted text-muted-foreground",
  },
};

export const ENROLLMENT_STATUS_OPTIONS: {
  value: EnrollmentStatus;
  label: string;
}[] = [
  { value: "pending", label: "Pending" },
  { value: "enrolled", label: "Enrolled" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
  { value: "withdrawn", label: "Withdrawn" },
];
