export type BillStatus = "unpaid" | "partial" | "paid";

export interface BillItem {
  id?: number;
  name: string;
  amount: number;
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
  termId: number;
  schoolYear: string | null;
  semester: string | null;
  status: BillStatus;
  total: number;
  amountPaid: number;
  balance: number;
  items: BillItem[];
  student?: BillStudent;
  createdAt: string | null;
}

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
