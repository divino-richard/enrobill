export type BillStatus = "unpaid" | "partial" | "paid";

export type BillTrackingState =
  | "with_balance"
  | "due_now"
  | "pending_payment";

export type InstallmentStatus = "unpaid" | "partial" | "paid" | "overdue";

export type PaymentMethod = "cash" | "gcash" | "maya" | "bank";

export type PaymentStatus = "pending" | "verified" | "rejected";

export interface InstallmentPolicy {
  downpaymentType: "percentage" | "fixed" | null;
  downpaymentValue: number | null;
  installmentCount: number | null;
}

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] =
  [
    { value: "cash", label: "Cash" },
    { value: "gcash", label: "GCash" },
    { value: "maya", label: "Maya" },
    { value: "bank", label: "Bank Transfer" },
  ];

export function paymentMethodLabel(method: string): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ??
    method
  );
}

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  verified: {
    label: "Verified",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  },
};

export interface BillItem {
  id?: number;
  name: string;
  amount: number;
}

export interface BillAdjustment {
  id: number;
  discountId: number | null;
  label: string;
  type: "fixed" | "percentage" | "full";
  value: number;
  amount: number;
}

export interface BillInstallment {
  id: number;
  sequence: number;
  label: string;
  amount: number;
  amountPaid: number;
  balance: number;
  dueDate: string | null;
  status: InstallmentStatus;
}

export interface BillPayment {
  id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  proofUrl: string | null;
  paidAt: string | null;
  note: string | null;
  recordedBy?: string | null;
  submittedBy?: string | null;
}

export interface BillStudent {
  id: number;
  studentNumber: string;
  name: string;
  track: string;
  yearLevel: string;
}

export interface Bill {
  id: number;
  studentId: number;
  schoolYearId: number;
  schoolYear: string | null;
  semester: string | null;
  status: BillStatus;
  noDownpayment: boolean;
  installmentPolicy: InstallmentPolicy | null;
  total: number;
  discountTotal: number;
  netTotal: number;
  amountPaid: number;
  balance: number;
  amountDue: number;
  items: BillItem[];
  adjustments?: BillAdjustment[];
  installments?: BillInstallment[];
  payments?: BillPayment[];
  student?: BillStudent;
  createdAt: string | null;
}

export const INSTALLMENT_STATUS_META: Record<
  InstallmentStatus,
  { label: string; className: string }
> = {
  unpaid: { label: "Unpaid", className: "text-muted-foreground" },
  partial: {
    label: "Partial",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  paid: {
    label: "Paid",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  overdue: {
    label: "Overdue",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  },
};

export const BILL_STATUS_META: Record<
  BillStatus,
  { label: string; className: string }
> = {
  unpaid: {
    label: "Unpaid",
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  partial: {
    label: "Partially paid",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  paid: {
    label: "Paid",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
};
