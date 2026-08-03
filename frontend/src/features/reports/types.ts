import type {
  BillStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/features/bills/types";
import type { Discount } from "@/features/discounts/types";
import type { EnrollmentStatus } from "@/features/enrollments/types";
import type { PaymentChannel } from "@/features/payment-channels/types";

export type ReportPeriod = "month" | "quarter" | "year";

export interface ReportSummary {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  pendingPayments: number;
  collectionRate: number;
  billsGenerated: number;
  activeStudents: number;
  voucherCredits: number;
}

export interface BillStatusSnapshot {
  status: BillStatus;
  count: number;
  total: number;
  note: string;
}

export interface PaymentMethodSnapshot {
  method: PaymentMethod;
  transactions: number;
  verifiedAmount: number;
  pendingCount: number;
}

export interface OutstandingBalanceRow {
  id: number;
  studentName: string;
  studentNumber: string;
  program: string;
  yearLevel: string;
  schoolYear: string;
  status: BillStatus;
  paymentStatus: PaymentStatus | null;
  netTotal: number;
  amountPaid: number;
  balance: number;
  amountDue: number;
}

export interface EnrollmentStatusSnapshot {
  status: EnrollmentStatus;
  count: number;
  note: string;
}

export interface ProgramMixRow {
  program: string;
  yearLevel: string;
  students: number;
  billed: number;
  noDownpayment: number;
}

export interface EnrollmentActivityRow {
  id: number;
  studentName: string;
  studentNumber: string;
  program: string;
  yearLevel: string;
  status: EnrollmentStatus;
  noDownpayment: boolean;
  hasBill: boolean;
  enrolledAt: string;
}

export interface VoucherUsageRow {
  discount: Discount;
  recipients: number;
  amountApplied: number;
  utilizationRate: number;
}

export interface CreditActivityRow {
  id: number;
  studentName: string;
  studentNumber: string;
  voucherName: string;
  amountApplied: number;
  billStatus: BillStatus;
  postedAt: string;
}

export interface ChannelAuditRow extends PaymentChannel {
  pendingProofs: number;
  verifiedAmount: number;
  lastReviewed: string | null;
}

export interface ReportDataset {
  updatedAt: string;
  summary: ReportSummary;
  billStatuses: BillStatusSnapshot[];
  paymentMethods: PaymentMethodSnapshot[];
  topBalances: OutstandingBalanceRow[];
  enrollmentStatuses: EnrollmentStatusSnapshot[];
  programMix: ProgramMixRow[];
  enrollmentActivity: EnrollmentActivityRow[];
  vouchers: VoucherUsageRow[];
  creditActivity: CreditActivityRow[];
  channelAudits: ChannelAuditRow[];
}
