import { useState } from "react";
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  BarChart3Icon,
  CalendarRangeIcon,
  ClockIcon,
  GraduationCapIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  TagIcon,
  WalletIcon,
} from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/features/applications/utils";
import {
  BILL_STATUS_META,
  PAYMENT_STATUS_META,
  paymentMethodLabel,
  type BillStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/features/bills/types";
import { type Discount, discountValueLabel } from "@/features/discounts/types";
import {
  ENROLLMENT_STATUS_META,
  type EnrollmentStatus,
} from "@/features/enrollments/types";
import { type PaymentChannel } from "@/features/payment-channels/types";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

type ReportPeriod = "month" | "quarter" | "year";

interface ReportTerm {
  id: number;
  schoolYear: string;
  isActive: boolean;
}

interface ReportSummary {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  pendingPayments: number;
  collectionRate: number;
  billsGenerated: number;
  activeStudents: number;
  voucherCredits: number;
}

interface BillStatusSnapshot {
  status: BillStatus;
  count: number;
  total: number;
  note: string;
}

interface PaymentMethodSnapshot {
  method: PaymentMethod;
  transactions: number;
  verifiedAmount: number;
  pendingCount: number;
}

interface OutstandingBalanceRow {
  id: number;
  studentName: string;
  studentNumber: string;
  program: string;
  yearLevel: string;
  schoolYear: string;
  status: BillStatus;
  paymentStatus: PaymentStatus;
  netTotal: number;
  amountPaid: number;
  balance: number;
  amountDue: number;
}

interface EnrollmentStatusSnapshot {
  status: EnrollmentStatus;
  count: number;
  note: string;
}

interface ProgramMixRow {
  program: string;
  yearLevel: string;
  students: number;
  billed: number;
  noDownpayment: number;
}

interface EnrollmentActivityRow {
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

interface VoucherUsageRow {
  discount: Discount;
  recipients: number;
  amountApplied: number;
  utilizationRate: number;
}

interface CreditActivityRow {
  id: number;
  studentName: string;
  studentNumber: string;
  voucherName: string;
  amountApplied: number;
  billStatus: BillStatus;
  postedAt: string;
}

interface ChannelAuditRow extends PaymentChannel {
  pendingProofs: number;
  verifiedAmount: number;
  lastReviewed: string;
}

interface ReportDataset {
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

const REPORT_TERMS: ReportTerm[] = [
  {
    id: 7,
    schoolYear: "2026-2027",
    isActive: true,
  },
  {
    id: 6,
    schoolYear: "2025-2026",
    isActive: false,
  },
];

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "School year view" },
];

const REPORT_DATA: Record<string, ReportDataset> = {
  "7": {
    updatedAt: "2026-06-27T09:15:00",
    summary: {
      totalBilled: 1523400,
      totalCollected: 984200,
      totalOutstanding: 539200,
      pendingPayments: 14,
      collectionRate: 64.6,
      billsGenerated: 218,
      activeStudents: 204,
      voucherCredits: 182500,
    },
    billStatuses: [
      {
        status: "paid",
        count: 94,
        total: 615800,
        note: "Accounts fully settled for the term.",
      },
      {
        status: "partial",
        count: 73,
        total: 503600,
        note: "Installment plans with active balances.",
      },
      {
        status: "unpaid",
        count: 51,
        total: 404000,
        note: "Bills awaiting first confirmed payment.",
      },
    ],
    paymentMethods: [
      {
        method: "cash",
        transactions: 118,
        verifiedAmount: 412500,
        pendingCount: 2,
      },
      {
        method: "gcash",
        transactions: 84,
        verifiedAmount: 326700,
        pendingCount: 7,
      },
      {
        method: "maya",
        transactions: 37,
        verifiedAmount: 154000,
        pendingCount: 4,
      },
      {
        method: "bank",
        transactions: 12,
        verifiedAmount: 91000,
        pendingCount: 1,
      },
    ],
    topBalances: [
      {
        id: 2018,
        studentName: "Alyssa Ramos",
        studentNumber: "2026-0142",
        program: "STEM",
        yearLevel: "Grade 12",
        schoolYear: "2026-2027",
        status: "partial",
        paymentStatus: "pending",
        netTotal: 15500,
        amountPaid: 3000,
        balance: 12500,
        amountDue: 2500,
      },
      {
        id: 2023,
        studentName: "Jerome Villanueva",
        studentNumber: "2026-0089",
        program: "ABM",
        yearLevel: "Grade 11",
        schoolYear: "2026-2027",
        status: "unpaid",
        paymentStatus: "rejected",
        netTotal: 14800,
        amountPaid: 0,
        balance: 14800,
        amountDue: 3200,
      },
      {
        id: 2047,
        studentName: "Ma. Elena Cruz",
        studentNumber: "2025-0314",
        program: "TVL - ICT",
        yearLevel: "Grade 12",
        schoolYear: "2026-2027",
        status: "partial",
        paymentStatus: "verified",
        netTotal: 16350,
        amountPaid: 5200,
        balance: 11150,
        amountDue: 1850,
      },
      {
        id: 2059,
        studentName: "Christian Pineda",
        studentNumber: "2026-0180",
        program: "HUMSS",
        yearLevel: "Grade 11",
        schoolYear: "2026-2027",
        status: "partial",
        paymentStatus: "pending",
        netTotal: 15100,
        amountPaid: 4500,
        balance: 10600,
        amountDue: 2100,
      },
    ],
    enrollmentStatuses: [
      {
        status: "enrolled",
        count: 156,
        note: "Marked enrolled after downpayment or full settlement.",
      },
      {
        status: "pending",
        count: 38,
        note: "Still waiting on billing or payment confirmation.",
      },
      {
        status: "completed",
        count: 6,
        note: "Prior-term students retained for historical totals.",
      },
      {
        status: "withdrawn",
        count: 3,
        note: "Initiated withdrawal before completion.",
      },
      {
        status: "dropped",
        count: 1,
        note: "Dropped after enrollment was posted.",
      },
    ],
    programMix: [
      {
        program: "STEM",
        yearLevel: "Grade 11",
        students: 48,
        billed: 46,
        noDownpayment: 4,
      },
      {
        program: "ABM",
        yearLevel: "Grade 11",
        students: 34,
        billed: 34,
        noDownpayment: 3,
      },
      {
        program: "TVL - ICT",
        yearLevel: "Grade 12",
        students: 29,
        billed: 28,
        noDownpayment: 5,
      },
      {
        program: "HUMSS",
        yearLevel: "Grade 12",
        students: 26,
        billed: 25,
        noDownpayment: 2,
      },
    ],
    enrollmentActivity: [
      {
        id: 901,
        studentName: "Bianca Salcedo",
        studentNumber: "2026-0204",
        program: "STEM",
        yearLevel: "Grade 11",
        status: "enrolled",
        noDownpayment: false,
        hasBill: true,
        enrolledAt: "2026-06-26T08:45:00",
      },
      {
        id: 902,
        studentName: "Kyle Hernandez",
        studentNumber: "2026-0188",
        program: "TVL - ICT",
        yearLevel: "Grade 11",
        status: "pending",
        noDownpayment: true,
        hasBill: true,
        enrolledAt: "2026-06-25T14:10:00",
      },
      {
        id: 903,
        studentName: "Samantha Go",
        studentNumber: "2026-0156",
        program: "ABM",
        yearLevel: "Grade 12",
        status: "enrolled",
        noDownpayment: false,
        hasBill: true,
        enrolledAt: "2026-06-24T11:25:00",
      },
      {
        id: 904,
        studentName: "Nico Alvarez",
        studentNumber: "2026-0111",
        program: "HUMSS",
        yearLevel: "Grade 11",
        status: "withdrawn",
        noDownpayment: false,
        hasBill: false,
        enrolledAt: "2026-06-23T16:30:00",
      },
    ],
    vouchers: [
      {
        discount: {
          id: 11,
          name: "Early Enrollment Voucher",
          category: "voucher",
          type: "fixed",
          value: 1500,
          isActive: true,
          createdAt: "2026-04-10T09:00:00",
        },
        recipients: 28,
        amountApplied: 42000,
        utilizationRate: 78,
      },
      {
        discount: {
          id: 12,
          name: "Academic Excellence Voucher",
          category: "voucher",
          type: "fixed",
          value: 2500,
          isActive: true,
          createdAt: "2026-04-18T09:00:00",
        },
        recipients: 19,
        amountApplied: 47500,
        utilizationRate: 61,
      },
      {
        discount: {
          id: 13,
          name: "Sibling Support Voucher",
          category: "voucher",
          type: "fixed",
          value: 2000,
          isActive: true,
          createdAt: "2026-05-02T09:00:00",
        },
        recipients: 23,
        amountApplied: 46000,
        utilizationRate: 69,
      },
    ],
    creditActivity: [
      {
        id: 301,
        studentName: "Angela de Mesa",
        studentNumber: "2026-0094",
        voucherName: "Academic Excellence Voucher",
        amountApplied: 2500,
        billStatus: "partial",
        postedAt: "2026-06-26T13:20:00",
      },
      {
        id: 302,
        studentName: "Mark Dela Cruz",
        studentNumber: "2026-0041",
        voucherName: "Early Enrollment Voucher",
        amountApplied: 1500,
        billStatus: "paid",
        postedAt: "2026-06-25T10:50:00",
      },
      {
        id: 303,
        studentName: "Chelsea Navarro",
        studentNumber: "2026-0137",
        voucherName: "Sibling Support Voucher",
        amountApplied: 2000,
        billStatus: "unpaid",
        postedAt: "2026-06-24T15:40:00",
      },
    ],
    channelAudits: [
      {
        id: 41,
        code: "gcash",
        label: "GCash",
        accountName: "Enrobill Collections",
        accountNumber: "0917 000 1122",
        isActive: true,
        hasQr: true,
        qrUrl: null,
        pendingProofs: 7,
        verifiedAmount: 326700,
        lastReviewed: "2026-06-27T08:30:00",
      },
      {
        id: 42,
        code: "maya",
        label: "Maya",
        accountName: "Enrobill Finance Office",
        accountNumber: "0998 220 0147",
        isActive: true,
        hasQr: true,
        qrUrl: null,
        pendingProofs: 4,
        verifiedAmount: 154000,
        lastReviewed: "2026-06-27T08:10:00",
      },
      {
        id: 43,
        code: "bank",
        label: "Bank Transfer",
        accountName: "NTC Treasury",
        accountNumber: "0110-6621-74",
        isActive: true,
        hasQr: false,
        qrUrl: null,
        pendingProofs: 1,
        verifiedAmount: 91000,
        lastReviewed: "2026-06-26T16:20:00",
      },
    ],
  },
  "6": {
    updatedAt: "2026-05-18T16:40:00",
    summary: {
      totalBilled: 1412500,
      totalCollected: 1319800,
      totalOutstanding: 92700,
      pendingPayments: 4,
      collectionRate: 93.4,
      billsGenerated: 207,
      activeStudents: 198,
      voucherCredits: 148000,
    },
    billStatuses: [
      {
        status: "paid",
        count: 166,
        total: 1096200,
        note: "Most balances were closed before term end.",
      },
      {
        status: "partial",
        count: 28,
        total: 205100,
        note: "Residual installment balances still open.",
      },
      {
        status: "unpaid",
        count: 13,
        total: 111200,
        note: "Carry-over accounts needing follow-up.",
      },
    ],
    paymentMethods: [
      {
        method: "cash",
        transactions: 131,
        verifiedAmount: 514300,
        pendingCount: 1,
      },
      {
        method: "gcash",
        transactions: 73,
        verifiedAmount: 418400,
        pendingCount: 2,
      },
      {
        method: "maya",
        transactions: 29,
        verifiedAmount: 212100,
        pendingCount: 1,
      },
      {
        method: "bank",
        transactions: 10,
        verifiedAmount: 175000,
        pendingCount: 0,
      },
    ],
    topBalances: [
      {
        id: 1854,
        studentName: "Noah Castillo",
        studentNumber: "2025-0251",
        program: "TVL - HE",
        yearLevel: "Grade 12",
        schoolYear: "2025-2026",
        status: "partial",
        paymentStatus: "pending",
        netTotal: 13900,
        amountPaid: 4800,
        balance: 9100,
        amountDue: 1800,
      },
      {
        id: 1891,
        studentName: "Patricia Ong",
        studentNumber: "2025-0176",
        program: "STEM",
        yearLevel: "Grade 12",
        schoolYear: "2025-2026",
        status: "unpaid",
        paymentStatus: "rejected",
        netTotal: 12150,
        amountPaid: 0,
        balance: 12150,
        amountDue: 2500,
      },
    ],
    enrollmentStatuses: [
      {
        status: "enrolled",
        count: 169,
        note: "Settled or in good standing by term close.",
      },
      {
        status: "pending",
        count: 17,
        note: "Pending cases archived for follow-up.",
      },
      {
        status: "completed",
        count: 9,
        note: "Graduating students posted as completed.",
      },
      {
        status: "withdrawn",
        count: 2,
        note: "Withdrawals finalized before closure.",
      },
      {
        status: "dropped",
        count: 1,
        note: "Dropped after attendance break.",
      },
    ],
    programMix: [
      {
        program: "STEM",
        yearLevel: "Grade 12",
        students: 44,
        billed: 44,
        noDownpayment: 2,
      },
      {
        program: "ABM",
        yearLevel: "Grade 12",
        students: 31,
        billed: 31,
        noDownpayment: 1,
      },
      {
        program: "TVL - HE",
        yearLevel: "Grade 11",
        students: 24,
        billed: 23,
        noDownpayment: 3,
      },
    ],
    enrollmentActivity: [
      {
        id: 880,
        studentName: "Louise Mendoza",
        studentNumber: "2025-0210",
        program: "ABM",
        yearLevel: "Grade 12",
        status: "completed",
        noDownpayment: false,
        hasBill: true,
        enrolledAt: "2026-05-14T09:20:00",
      },
      {
        id: 881,
        studentName: "Gabriel Solis",
        studentNumber: "2025-0114",
        program: "TVL - HE",
        yearLevel: "Grade 11",
        status: "pending",
        noDownpayment: true,
        hasBill: true,
        enrolledAt: "2026-05-13T15:00:00",
      },
    ],
    vouchers: [
      {
        discount: {
          id: 7,
          name: "Returning Student Voucher",
          category: "voucher",
          type: "fixed",
          value: 1000,
          isActive: true,
          createdAt: "2025-11-02T09:00:00",
        },
        recipients: 36,
        amountApplied: 36000,
        utilizationRate: 82,
      },
      {
        discount: {
          id: 8,
          name: "Merit Voucher",
          category: "voucher",
          type: "fixed",
          value: 2000,
          isActive: true,
          createdAt: "2025-11-15T09:00:00",
        },
        recipients: 21,
        amountApplied: 42000,
        utilizationRate: 68,
      },
    ],
    creditActivity: [
      {
        id: 280,
        studentName: "Ethan Torres",
        studentNumber: "2025-0015",
        voucherName: "Merit Voucher",
        amountApplied: 2000,
        billStatus: "paid",
        postedAt: "2026-05-16T11:10:00",
      },
      {
        id: 281,
        studentName: "Shaira Gomez",
        studentNumber: "2025-0228",
        voucherName: "Returning Student Voucher",
        amountApplied: 1000,
        billStatus: "partial",
        postedAt: "2026-05-15T14:05:00",
      },
    ],
    channelAudits: [
      {
        id: 31,
        code: "gcash",
        label: "GCash",
        accountName: "Enrobill Collections",
        accountNumber: "0917 000 1122",
        isActive: true,
        hasQr: true,
        qrUrl: null,
        pendingProofs: 2,
        verifiedAmount: 418400,
        lastReviewed: "2026-05-18T15:50:00",
      },
      {
        id: 32,
        code: "bank",
        label: "Bank Transfer",
        accountName: "NTC Treasury",
        accountNumber: "0110-6621-74",
        isActive: true,
        hasQr: false,
        qrUrl: null,
        pendingProofs: 0,
        verifiedAmount: 175000,
        lastReviewed: "2026-05-18T12:40:00",
      },
    ],
  },
};

function ReportsPage() {
  const [selectedTermId, setSelectedTermId] = useState(
    String(REPORT_TERMS[0].id),
  );
  const [period, setPeriod] = useState<ReportPeriod>("year");

  const selectedTerm =
    REPORT_TERMS.find((term) => String(term.id) === selectedTermId) ??
    REPORT_TERMS[0];
  const dataset = REPORT_DATA[selectedTermId] ?? REPORT_DATA[String(selectedTerm.id)];

  const totalBillStatusAmount = dataset.billStatuses.reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const totalMethodAmount = dataset.paymentMethods.reduce(
    (sum, item) => sum + item.verifiedAmount,
    0,
  );
  const totalEnrollmentCount = dataset.enrollmentStatuses.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const maxProgramCount = Math.max(...dataset.programMix.map((row) => row.students));
  const averageBill = Math.round(
    dataset.summary.totalBilled / dataset.summary.billsGenerated,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <Badge variant="outline" className="bg-background">
              Preview data
            </Badge>
            {selectedTerm.isActive && (
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                Active term
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Finance and enrollment snapshots based on the current backend
            entities for bills, payments, enrollments, vouchers, and payment
            channels.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selectedTermId} onValueChange={setSelectedTermId}>
            <SelectTrigger className="min-w-44">
              <CalendarRangeIcon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="School year" />
            </SelectTrigger>
              <SelectContent>
              {REPORT_TERMS.map((term) => (
                <SelectItem key={term.id} value={String(term.id)}>
                  {`SY ${term.schoolYear}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as ReportPeriod)}
          >
            <SelectTrigger className="min-w-40">
              <BarChart3Icon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" type="button">
            <ReceiptTextIcon />
            Export snapshot
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 bg-gradient-to-br from-primary/8 via-background to-muted/60">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-background/80">
                {`SY ${selectedTerm.schoolYear}`}
              </Badge>
              <Badge variant="outline" className="bg-background/80">
                {
                  PERIOD_OPTIONS.find((option) => option.value === period)
                    ?.label
                }
              </Badge>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                Collection posture is at {dataset.summary.collectionRate}% for
                the selected view.
              </h2>
              <p className="text-muted-foreground text-sm leading-6">
                Bills are anchored to school year and enrollment records, while
                verified payments and voucher credits explain how much of the
                billed amount has already been realized.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <HighlightTile
              label="Snapshot updated"
              value={formatDate(dataset.updatedAt)}
              hint="Dummy reporting data"
              icon={ClockIcon}
            />
            <HighlightTile
              label="Average bill"
              value={formatPeso(averageBill)}
              hint={`${dataset.summary.billsGenerated} generated bills`}
              icon={ReceiptTextIcon}
            />
            <HighlightTile
              label="Voucher credits"
              value={formatPeso(dataset.summary.voucherCredits)}
              hint="Applied through bill adjustments"
              icon={TagIcon}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total billed"
          value={formatPeso(dataset.summary.totalBilled)}
          hint={`${dataset.summary.billsGenerated} bills generated`}
          icon={ReceiptTextIcon}
        />
        <StatTile
          label="Collected"
          value={formatPeso(dataset.summary.totalCollected)}
          hint={`${dataset.summary.collectionRate}% collection rate`}
          icon={WalletIcon}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatTile
          label="Outstanding"
          value={formatPeso(dataset.summary.totalOutstanding)}
          hint={`${dataset.summary.activeStudents} active students`}
          icon={BanknoteIcon}
          accent="text-amber-600 dark:text-amber-400"
        />
        <StatTile
          label="Pending reviews"
          value={dataset.summary.pendingPayments}
          hint="Payments awaiting verification"
          icon={ClockIcon}
          accent="text-violet-600 dark:text-violet-400"
        />
      </div>

      <Tabs defaultValue="collections" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
          <TabsTrigger value="credits">Credits & Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bills by status</CardTitle>
                <CardDescription>
                  Distribution based on the `Bill.status` lifecycle.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataset.billStatuses.map((item) => (
                  <MeterRow
                    key={item.status}
                    label={BILL_STATUS_META[item.status].label}
                    value={item.total}
                    total={totalBillStatusAmount}
                    badge={`${item.count} accounts`}
                    meta={formatPeso(item.total)}
                    note={item.note}
                    tone={billTone(item.status)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verified payments</CardTitle>
                <CardDescription>
                  Settlement mix using `Payment.method` and verification status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataset.paymentMethods.map((item) => (
                  <MeterRow
                    key={item.method}
                    label={paymentMethodLabel(item.method)}
                    value={item.verifiedAmount}
                    total={totalMethodAmount}
                    badge={`${item.transactions} posts`}
                    meta={formatPeso(item.verifiedAmount)}
                    note={`${item.pendingCount} pending verification${item.pendingCount === 1 ? "" : "s"}`}
                    tone={paymentMethodTone(item.method)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Largest open balances</CardTitle>
              <CardDescription>
                High-balance students based on net total, amount paid, and due
                now from the billing model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Net total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Due now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.topBalances.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.studentName}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.studentNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{row.program}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.yearLevel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span>{`SY ${row.schoolYear}`}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(BILL_STATUS_META[row.status].className)}
                        >
                          {BILL_STATUS_META[row.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            PAYMENT_STATUS_META[row.paymentStatus].className,
                          )}
                        >
                          {PAYMENT_STATUS_META[row.paymentStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(row.netTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(row.amountPaid)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPeso(row.balance)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-700 dark:text-amber-300">
                        {formatPeso(row.amountDue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollment" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Enrollment status snapshot
                </CardTitle>
                <CardDescription>
                  Based on the `Enrollment.status` states used across the admin
                  workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataset.enrollmentStatuses.map((item) => (
                  <MeterRow
                    key={item.status}
                    label={ENROLLMENT_STATUS_META[item.status].label}
                    value={item.count}
                    total={totalEnrollmentCount}
                    badge={`${item.count} students`}
                    meta={`${Math.round((item.count / totalEnrollmentCount) * 100)}%`}
                    note={item.note}
                    tone={enrollmentTone(item.status)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Program mix</CardTitle>
                <CardDescription>
                  Student counts grouped by track and year level with billing
                  coverage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataset.programMix.map((row) => (
                  <div key={`${row.program}-${row.yearLevel}`} className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.program}</p>
                        <p className="text-muted-foreground text-xs">
                          {row.yearLevel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{row.students} students</p>
                        <p className="text-muted-foreground text-xs">
                          {row.billed} billed · {row.noDownpayment} no-DP
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted h-2 rounded-full">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${Math.max(
                            (row.students / maxProgramCount) * 100,
                            10,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent enrollment activity
              </CardTitle>
              <CardDescription>
                A preview of what a live admissions and enrollment report could
                show once wired to the API.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>No downpayment</TableHead>
                    <TableHead className="text-right">Enrolled at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.enrollmentActivity.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.studentName}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.studentNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{row.program}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.yearLevel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            ENROLLMENT_STATUS_META[row.status].className,
                          )}
                        >
                          {ENROLLMENT_STATUS_META[row.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.hasBill ? "secondary" : "outline"}>
                          {row.hasBill ? "Bill generated" : "No bill yet"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.noDownpayment ? "secondary" : "outline"}>
                          {row.noDownpayment ? "Allowed" : "Standard"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(row.enrolledAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Voucher utilization</CardTitle>
                <CardDescription>
                  Dummy entries mirror the current voucher-focused discount
                  catalog.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataset.vouchers.map((item) => (
                  <div key={item.discount.id} className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.discount.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {discountValueLabel(item.discount)}
                        </p>
                      </div>
                      <Badge variant="outline">{item.recipients} recipients</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniStat
                        icon={TagIcon}
                        label="Applied"
                        value={formatPeso(item.amountApplied)}
                      />
                      <MiniStat
                        icon={GraduationCapIcon}
                        label="Recipients"
                        value={String(item.recipients)}
                      />
                      <MiniStat
                        icon={ArrowUpRightIcon}
                        label="Utilization"
                        value={`${item.utilizationRate}%`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Payment channel audit
                </CardTitle>
                <CardDescription>
                  Channel readiness using QR availability and recent finance
                  review status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataset.channelAudits.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.label}</p>
                          <Badge
                            variant="outline"
                            className={
                              item.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                                : undefined
                            }
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {item.accountName}
                          {item.accountNumber ? ` · ${item.accountNumber}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={item.hasQr ? "secondary" : "outline"}>
                          {item.hasQr ? "QR ready" : "No QR"}
                        </Badge>
                        <Badge variant="outline">
                          {item.pendingProofs} pending
                        </Badge>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniStat
                        icon={WalletIcon}
                        label="Verified amount"
                        value={formatPeso(item.verifiedAmount)}
                      />
                      <MiniStat
                        icon={QrCodeIcon}
                        label="Last reviewed"
                        value={formatDate(item.lastReviewed)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent credit activity</CardTitle>
              <CardDescription>
                Voucher applications mapped back to bill status for finance
                follow-up.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount applied</TableHead>
                    <TableHead className="text-right">Posted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.creditActivity.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.studentName}</span>
                          <span className="text-muted-foreground text-xs">
                            {row.studentNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{row.voucherName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            BILL_STATUS_META[row.billStatus].className,
                          )}
                        >
                          {BILL_STATUS_META[row.billStatus].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPeso(row.amountApplied)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(row.postedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HighlightTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof ClockIcon;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/75 p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {label}
        </p>
        <div className="bg-muted text-primary flex size-8 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="text-base font-semibold tracking-tight">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof WalletIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/50 flex items-start gap-3 rounded-lg border border-border/60 p-3">
      <div className="bg-background text-primary flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function MeterRow({
  label,
  value,
  total,
  badge,
  meta,
  note,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  badge: string;
  meta: string;
  note: string;
  tone: "primary" | "success" | "warning" | "violet";
}) {
  const width = total > 0 ? Math.max((value / total) * 100, 6) : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{label}</p>
            <Badge variant="outline">{badge}</Badge>
          </div>
          <p className="text-muted-foreground text-xs">{note}</p>
        </div>
        <p className="font-medium">{meta}</p>
      </div>
      <div className="bg-muted h-2 rounded-full">
        <div
          className={cn(
            "h-2 rounded-full",
            tone === "primary" && "bg-primary",
            tone === "success" && "bg-emerald-500",
            tone === "warning" && "bg-amber-500",
            tone === "violet" && "bg-violet-500",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function billTone(status: BillStatus) {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
      return "primary";
    case "unpaid":
      return "warning";
  }
}

function paymentMethodTone(method: PaymentMethod) {
  switch (method) {
    case "cash":
      return "success";
    case "gcash":
      return "primary";
    case "maya":
      return "violet";
    case "bank":
      return "warning";
  }
}

function enrollmentTone(status: EnrollmentStatus) {
  switch (status) {
    case "enrolled":
      return "success";
    case "pending":
      return "warning";
    case "completed":
      return "violet";
    case "dropped":
    case "withdrawn":
      return "primary";
  }
}

export default ReportsPage;
