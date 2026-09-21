import { useState, type ReactNode } from "react";
import { BarChart3Icon, CalendarRangeIcon, ReceiptTextIcon } from "lucide-react";
import {
  DashboardHeader,
  DashboardLoading,
  DashboardMetricStrip,
  DashboardPanel,
  type DashboardMetric,
} from "@/components/dashboard/dashboard-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/features/bills/types";
import { discountValueLabel } from "@/features/discounts/types";
import { ENROLLMENT_STATUS_META } from "@/features/enrollments/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useReports } from "@/features/reports/hooks";
import { printReport } from "@/features/reports/print";
import type {
  CreditActivityRow,
  EnrollmentActivityRow,
  OutstandingBalanceRow,
  ReportDataset,
  ReportPeriod,
} from "@/features/reports/types";
import { useTerms } from "@/features/terms/hooks";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "School year view" },
];

const number = new Intl.NumberFormat("en-PH");
type BreakdownDatum = {
  name: string;
  value: number;
  valueLabel: string;
  meta: string;
  note?: string;
  color: string;
};

function ReportsPage() {
  const {
    data: terms,
    isLoading: termsLoading,
    isError: termsError,
    refetch: refetchTerms,
  } = useTerms();
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>("year");
  const programLabel = useProgramLabel();

  const defaultTerm = terms?.find((term) => term.isActive) ?? terms?.[0] ?? null;
  const selectedTerm =
    (selectedTermId
      ? terms?.find((term) => String(term.id) === selectedTermId)
      : null) ?? defaultTerm;

  const {
    data: dataset,
    isLoading: reportLoading,
    isError: reportError,
    refetch,
  } = useReports({ schoolYearId: selectedTerm?.id, period });

  if (termsLoading || reportLoading) return <DashboardLoading />;

  if (termsError || !terms) {
    return (
      <ReportState
        title="Reports unavailable"
        message="The academic years could not be loaded. Check your connection and try again."
        retry={() => refetchTerms()}
      />
    );
  }

  if (terms.length === 0) {
    return (
      <ReportState
        title="Set up an academic year"
        message="Reports become available after an academic year has been created."
      />
    );
  }

  if (reportError || !dataset) {
    return (
      <ReportState
        title="Reports unavailable"
        message="The selected report could not be loaded. Check your connection and try again."
        retry={() => refetch()}
      />
    );
  }

  const periodLabel =
    PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "";
  const averageBill = dataset.summary.billsGenerated
    ? Math.round(dataset.summary.totalBilled / dataset.summary.billsGenerated)
    : 0;
  const metrics: DashboardMetric[] = [
    {
      label: "Total billed",
      explanation: "Fees billed during the selected reporting period.",
      value: formatPeso(dataset.summary.totalBilled),
      detail: `${number.format(dataset.summary.billsGenerated)} bills · ${formatPeso(averageBill)} average`,
      tone: "primary",
    },
    {
      label: "Collected",
      value: formatPeso(dataset.summary.totalCollected),
      detail: `${dataset.summary.collectionRate}% collection rate`,
      tone: "success",
    },
    {
      label: "Outstanding",
      value: formatPeso(dataset.summary.totalOutstanding),
      detail: `${number.format(dataset.summary.activeStudents)} active students`,
      tone: dataset.summary.totalOutstanding ? "warning" : "success",
    },
    {
      label: "Payment reviews",
      value: number.format(dataset.summary.pendingPayments),
      detail: "Payment proofs awaiting review",
      tone: dataset.summary.pendingPayments ? "warning" : "success",
    },
  ];

  const financialData: BreakdownDatum[] = [
    {
      name: "Total billed",
      value: dataset.summary.totalBilled,
      valueLabel: formatPeso(dataset.summary.totalBilled),
      meta: `${number.format(dataset.summary.billsGenerated)} bills`,
      color: "var(--color-chart-1)",
    },
    {
      name: "Collected",
      value: dataset.summary.totalCollected,
      valueLabel: formatPeso(dataset.summary.totalCollected),
      meta: `${dataset.summary.collectionRate}% realized`,
      color: "var(--color-chart-4)",
    },
    {
      name: "Outstanding",
      value: dataset.summary.totalOutstanding,
      valueLabel: formatPeso(dataset.summary.totalOutstanding),
      meta: `${number.format(dataset.summary.activeStudents)} active students`,
      color: "var(--color-chart-3)",
    },
  ];
  const billData: BreakdownDatum[] = dataset.billStatuses.map((item) => ({
    name: BILL_STATUS_META[item.status].label,
    value: item.total,
    valueLabel: formatPeso(item.total),
    meta: `${number.format(item.count)} accounts`,
    note: item.note,
    color:
      item.status === "paid"
        ? "var(--color-chart-4)"
        : item.status === "partial"
          ? "var(--color-chart-2)"
          : "var(--color-chart-3)",
  }));
  const paymentColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-5)",
  ];
  const paymentData: BreakdownDatum[] = dataset.paymentMethods.map((item, index) => ({
    name: paymentMethodLabel(item.method),
    value: item.verifiedAmount,
    valueLabel: formatPeso(item.verifiedAmount),
    meta: `${number.format(item.transactions)} ${item.transactions === 1 ? "post" : "posts"} · ${number.format(item.pendingCount)} pending`,
    color: paymentColors[index % paymentColors.length],
  }));
  const enrollmentData: BreakdownDatum[] = dataset.enrollmentStatuses.map(
    (item) => ({
      name: ENROLLMENT_STATUS_META[item.status].label,
      value: item.count,
      valueLabel: number.format(item.count),
      meta: `${number.format(item.count)} ${item.count === 1 ? "student" : "students"}`,
      note: item.note,
      color:
        item.status === "enrolled"
          ? "var(--color-chart-4)"
          : item.status === "pending"
            ? "var(--color-chart-3)"
            : item.status === "completed"
              ? "var(--color-chart-1)"
              : "var(--color-destructive)",
    }),
  );
  const programData: BreakdownDatum[] = dataset.programMix.map((item, index) => ({
    name: `${programLabel(item.program).replace(/\s*\([^)]*\)/g, "").trim()} · ${yearLevelLabel(item.yearLevel)}`,
    value: item.students,
    valueLabel: number.format(item.students),
    meta: `${number.format(item.billed)} billed · ${number.format(item.noDownpayment)} no-DP`,
    color: index % 2 === 0 ? "var(--color-chart-1)" : "var(--color-chart-2)",
  }));
  const voucherData: BreakdownDatum[] = dataset.vouchers.map((item) => ({
    name: item.discount.name,
    value: item.amountApplied,
    valueLabel: formatPeso(item.amountApplied),
    meta: `${number.format(item.recipients)} recipients`,
    note: discountValueLabel(item.discount),
    color: "var(--color-chart-1)",
  }));

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Reports"
        context={selectedTerm?.isActive ? <Badge variant="secondary">Active term</Badge> : null}
      />

      <Card className="gap-4 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="mr-4 sm:self-center"><p className="text-sm font-semibold">Report scope</p><p className="text-muted-foreground mt-1 text-xs">{periodLabel}</p></div>
        <ReportFilter label="Academic year">
          <Select
            value={selectedTerm ? String(selectedTerm.id) : undefined}
            onValueChange={setSelectedTermId}
          >
            <SelectTrigger className="w-full min-w-44 bg-card sm:w-auto">
              <CalendarRangeIcon className="text-muted-foreground size-4" />
              <SelectValue placeholder="School year" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
                <SelectItem key={term.id} value={String(term.id)}>
                  SY {term.schoolYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ReportFilter>
        <ReportFilter label="Reporting period">
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as ReportPeriod)}
          >
            <SelectTrigger className="w-full min-w-40 bg-card sm:w-auto">
              <BarChart3Icon className="text-muted-foreground size-4" />
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
        </ReportFilter>
        <div className="text-muted-foreground min-w-0 text-sm sm:ml-auto sm:pb-2">
          Updated <span className="font-medium text-foreground">{formatDate(dataset.updatedAt)}</span>
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() =>
            printReport(
              dataset,
              {
                schoolYear: selectedTerm ? `SY ${selectedTerm.schoolYear}` : "—",
                periodLabel,
              },
              programLabel,
            )
          }
        >
          <ReceiptTextIcon />
          Export snapshot
        </Button>
      </Card>

      <DashboardMetricStrip metrics={metrics} />

      <Tabs defaultValue="collections" className="gap-3">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-card p-1 shadow-xs ring-1 ring-foreground/10 sm:flex sm:w-fit">
          <TabsTrigger className="w-full px-2 sm:w-auto sm:px-4" value="collections">Collections</TabsTrigger>
          <TabsTrigger className="w-full px-2 sm:w-auto sm:px-4" value="enrollment">Enrollment</TabsTrigger>
          <TabsTrigger className="w-full px-2 sm:w-auto sm:px-4" value="credits">Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
            <ReportBreakdown
              title="Billing position"
              description="Selected period"
              data={financialData}
              comparison
              empty="No billing activity found for this reporting window."
              footer={<StatusSummary data={billData} />}
            />
            <RankedListPanel
              title="Payment mix"
              description={`${number.format(paymentData.length)} channels`}
              data={paymentData}
              empty="No verified payments found for this reporting window."
            />
          </div>
          <TopBalancesPanel rows={dataset.topBalances} />
        </TabsContent>

        <TabsContent value="enrollment" className="space-y-4">
          <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
            <ReportBreakdown
              title="Enrollment composition"
              description="Selected period"
              data={enrollmentData}
              empty="No enrollments found for this reporting window."
            />
            <RankedListPanel
              title="Program ranking"
              description={`${number.format(programData.length)} programs`}
              data={programData}
              empty="No enrolled students found for this reporting window."
            />
          </div>
          <EnrollmentActivityPanel rows={dataset.enrollmentActivity} />
        </TabsContent>

        <TabsContent value="credits" className="space-y-4">
          <CreditTotals
            voucherCredits={dataset.summary.voucherCredits}
            incentiveCredits={dataset.summary.incentiveCredits ?? 0}
          />
          <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
            <VoucherCreditsPanel
              title="Voucher credits"
              description="Applied value"
              data={voucherData}
              empty="No voucher activity found for this reporting window."
            />
            <ChannelReadinessPanel dataset={dataset} />
          </div>
          <CreditActivityPanel rows={dataset.creditActivity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportFilter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5 sm:flex-none">
      <span className="text-muted-foreground block text-[0.8125rem] font-medium">{label}</span>
      {children}
    </div>
  );
}

function ReportBreakdown({
  title,
  description,
  data,
  empty,
  footer,
  comparison = false,
}: {
  title: string;
  description: string;
  data: BreakdownDatum[];
  empty: string;
  footer?: ReactNode;
  comparison?: boolean;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <DashboardPanel title={title} description={description}>
      {data.length === 0 ? <EmptyData>{empty}</EmptyData> : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">{comparison ? "Billing summary" : "Enrollment status"}</TableHead>
                <TableHead className="text-right">{comparison ? "Amount" : "Students"}</TableHead>
                <TableHead className="px-4 text-right">{comparison ? "Details" : "Share"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.name}>
                  <TableCell className="px-4 py-5 font-medium whitespace-normal">{item.name}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{item.valueLabel}</TableCell>
                  <TableCell className="text-muted-foreground px-4 text-right text-xs whitespace-normal tabular-nums">{comparison ? item.meta : total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : "—"}</TableCell>
                </TableRow>
              ))}
              {!comparison && <TableRow className="bg-muted/30"><TableCell className="px-4 py-4 font-semibold">Total enrollments</TableCell><TableCell className="text-right font-semibold tabular-nums">{number.format(total)}</TableCell><TableCell className="text-muted-foreground px-4 text-right text-xs">{total > 0 ? "100%" : "—"}</TableCell></TableRow>}
            </TableBody>
          </Table>
          {footer ? <div className="mt-auto border-t">{footer}</div> : null}
        </>
      )}
    </DashboardPanel>
  );
}

function VoucherCreditsPanel({ title, description, data, empty }: { title: string; description: string; data: BreakdownDatum[]; empty: string }) {
  return <DashboardPanel title={title} description={description}>
    {data.length === 0 ? <EmptyData>{empty}</EmptyData> : <div className="divide-y px-4">{data.map((item) => (
      <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="font-semibold">{item.name}</p><p className="text-muted-foreground mt-1 text-sm">{item.meta}{item.note ? ` · ${item.note}` : ""}</p></div>
        <div className="text-right"><p className="font-semibold tabular-nums">{item.valueLabel}</p><p className="text-muted-foreground text-xs">Applied credits</p></div>
      </div>
    ))}</div>}
  </DashboardPanel>;
}

function StatusSummary({ data }: { data: BreakdownDatum[] }) {
  return (
    <div className="grid sm:grid-cols-3">
      {data.map((item) => (
        <div key={item.name} className="border-b px-4 py-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground text-[0.8125rem]">{item.name}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <strong className="text-sm tabular-nums">{item.valueLabel}</strong>
            <span className="text-muted-foreground text-[0.8125rem]">{item.meta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const DESKTOP_SCROLL_AREA = "xl:max-h-[19rem] xl:overflow-y-auto xl:overscroll-contain xl:pr-2 xl:[scrollbar-gutter:stable] xl:[&::-webkit-scrollbar-thumb]:rounded-full xl:[&::-webkit-scrollbar-thumb]:bg-border xl:[&::-webkit-scrollbar-track]:bg-transparent xl:[&::-webkit-scrollbar]:w-1.5";

function RankedListPanel({ title, description, data, empty }: { title: string; description: string; data: BreakdownDatum[]; empty: string }) {
  const maximum = Math.max(...data.map((item) => item.value), 1);

  return (
    <DashboardPanel title={title} description={description}>
      {data.length === 0 ? <EmptyData>{empty}</EmptyData> : (
        <div className={cn("px-4", DESKTOP_SCROLL_AREA)}>
          {[...data].sort((left, right) => right.value - left.value).map((item) => (
            <div key={item.name} className="border-b py-4 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-[0.8125rem]">{item.meta}</p>
                </div>
                <strong className="shrink-0 text-sm tabular-nums">{item.valueLabel}</strong>
              </div>
              <div className="bg-muted mt-2.5 h-1.5 overflow-hidden rounded-sm">
                <div className="h-full rounded-sm" style={{ width: `${Math.max((item.value / maximum) * 100, item.value ? 3 : 0)}%`, backgroundColor: item.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}

function CreditTotals({ voucherCredits, incentiveCredits }: { voucherCredits: number; incentiveCredits: number }) {
  return (
    <Card className="grid gap-0 py-0 sm:grid-cols-2">
      <div className="border-b p-4 sm:border-r sm:border-b-0">
        <span className="text-muted-foreground text-sm">Voucher credits</span>
        <strong className="mt-1 block text-lg font-semibold tabular-nums">{formatPeso(voucherCredits)}</strong>
      </div>
      <div className="p-4">
        <span className="text-muted-foreground text-sm">Tuition incentive credits</span>
        <strong className="mt-1 block text-lg font-semibold tabular-nums">{formatPeso(incentiveCredits)}</strong>
      </div>
    </Card>
  );
}

function TopBalancesPanel({ rows }: { rows: OutstandingBalanceRow[] }) {
  return (
    <DashboardPanel title="Largest open balances" description={`${rows.length} records · highest first`}>
      <div className="overflow-x-auto">
        <Table className="min-w-[52rem] text-sm">
          <TableHeader className="bg-muted/40"><TableRow><TableHead className="h-10">Student</TableHead><TableHead className="h-10">Status</TableHead><TableHead className="h-10 text-right">Net total</TableHead><TableHead className="h-10 text-right">Paid</TableHead><TableHead className="h-10 text-right">Balance</TableHead><TableHead className="h-10 text-right">Due now</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <EmptyTable colSpan={6}>No open balances for this term.</EmptyTable> : rows.map((row) => (
              <TableRow key={row.id} className="h-14">
                <TableCell className="py-1.5"><StudentCell name={row.studentName} number={row.studentNumber} context={`${programCodeLabel(row.program)} · ${yearLevelLabel(row.yearLevel)}`} /></TableCell>
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn(COMPACT_BADGE, BILL_STATUS_META[row.status].className)}>{BILL_STATUS_META[row.status].label}</Badge>
                    {row.paymentStatus ? <Badge variant="outline" className={cn(COMPACT_BADGE, PAYMENT_STATUS_META[row.paymentStatus].className)}>{PAYMENT_STATUS_META[row.paymentStatus].label}</Badge> : <span className="text-muted-foreground text-[0.8125rem]">No payments</span>}
                  </div>
                </TableCell>
                <TableCell className="py-1.5 text-right tabular-nums">{formatPeso(row.netTotal)}</TableCell>
                <TableCell className="py-1.5 text-right tabular-nums">{formatPeso(row.amountPaid)}</TableCell>
                <TableCell className="py-1.5 text-right font-semibold tabular-nums">{formatPeso(row.balance)}</TableCell>
                <TableCell className="py-1.5 text-right font-semibold text-amber-700 tabular-nums dark:text-amber-300">{formatPeso(row.amountDue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardPanel>
  );
}

function EnrollmentActivityPanel({ rows }: { rows: EnrollmentActivityRow[] }) {
  return (
    <DashboardPanel title="Recent enrollment activity" description={`${rows.length} records · newest first`}>
      <div className="overflow-x-auto">
        <Table className="min-w-[40rem] text-sm">
          <TableHeader className="bg-muted/40"><TableRow><TableHead className="h-10">Student</TableHead><TableHead className="h-10">Status</TableHead><TableHead className="h-10">Billing</TableHead><TableHead className="h-10 text-right">Enrolled</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <EmptyTable colSpan={4}>No enrollment activity in this window.</EmptyTable> : rows.map((row) => (
              <TableRow key={row.id} className="h-14">
                <TableCell className="py-1.5"><StudentCell name={row.studentName} number={row.studentNumber} context={`${programCodeLabel(row.program)} · ${yearLevelLabel(row.yearLevel)}`} /></TableCell>
                <TableCell className="py-1.5"><Badge variant="outline" className={cn(COMPACT_BADGE, ENROLLMENT_STATUS_META[row.status].className)}>{ENROLLMENT_STATUS_META[row.status].label}</Badge></TableCell>
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={row.hasBill ? "secondary" : "outline"} className={COMPACT_BADGE}>{row.hasBill ? "Billed" : "No bill"}</Badge>
                    <Badge variant={row.noDownpayment ? "secondary" : "outline"} className={COMPACT_BADGE}>{row.noDownpayment ? "No DP" : "Standard"}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground py-1.5 text-right">{formatDate(row.enrolledAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardPanel>
  );
}

function ChannelReadinessPanel({ dataset }: { dataset: ReportDataset }) {
  return (
    <DashboardPanel
      title="Payment channel readiness"
      description={`${number.format(dataset.channelAudits.length)} channels`}
    >
      {dataset.channelAudits.length === 0 ? <EmptyData>No payment methods are configured yet.</EmptyData> : (
        <div className={cn("px-4", DESKTOP_SCROLL_AREA)}>
          {dataset.channelAudits.map((item) => (
            <div key={item.id} className="border-b py-4 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.label}</p><Badge variant={item.isActive ? "secondary" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge><Badge variant="outline">{item.hasQr ? "QR ready" : "No QR"}</Badge></div>
                  <p className="text-muted-foreground mt-1 truncate text-sm">{item.accountName}{item.accountNumber ? ` · ${item.accountNumber}` : ""}</p>
                </div>
                <div className="text-right"><p className="font-semibold tabular-nums">{formatPeso(item.verifiedAmount)}</p><p className="text-muted-foreground mt-1 text-sm">{number.format(item.pendingProofs)} pending</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}

function CreditActivityPanel({ rows }: { rows: CreditActivityRow[] }) {
  return (
    <DashboardPanel title="Recent credit activity" description={`${rows.length} records · latest first`}>
      <div className="overflow-x-auto">
        <Table className="min-w-[42rem] text-sm">
          <TableHeader className="bg-muted/40"><TableRow><TableHead className="h-10">Student</TableHead><TableHead className="h-10">Credit</TableHead><TableHead className="h-10">Status</TableHead><TableHead className="h-10 text-right">Amount applied</TableHead><TableHead className="h-10 text-right">Posted</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <EmptyTable colSpan={5}>No credit activity in this window.</EmptyTable> : rows.map((row) => (
              <TableRow key={row.id} className="h-14">
                <TableCell className="py-1.5"><PersonCell name={row.studentName} detail={row.studentNumber} /></TableCell>
                <TableCell className="py-1.5"><PersonCell name={row.creditName ?? row.voucherName} detail={row.reasons?.join(" + ")} /></TableCell>
                <TableCell className="py-1.5"><Badge variant="outline" className={cn(COMPACT_BADGE, BILL_STATUS_META[row.billStatus].className)}>{BILL_STATUS_META[row.billStatus].label}</Badge></TableCell>
                <TableCell className="py-1.5 text-right font-semibold tabular-nums">{formatPeso(row.amountApplied)}</TableCell>
                <TableCell className="text-muted-foreground py-1.5 text-right">{formatDate(row.postedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardPanel>
  );
}

const COMPACT_BADGE = "h-5 rounded-md px-1.5 text-xs leading-none";

function StudentCell({ name, number: studentNumber, context }: { name: string; number: string; context: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{name}</p>
      <p className="text-muted-foreground mt-0.5 truncate text-[0.8125rem]">{studentNumber} · {context}</p>
    </div>
  );
}

function yearLevelLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function programCodeLabel(value: string) {
  return value.trim().toUpperCase();
}

function PersonCell({ name, detail }: { name: string; detail?: string }) {
  return <div className="flex min-w-0 flex-col"><span className="truncate font-medium">{name}</span>{detail ? <span className="text-muted-foreground mt-0.5 truncate text-[0.8125rem]">{detail}</span> : null}</div>;
}

function EmptyData({ children }: { children: string }) {
  return <p className="text-muted-foreground px-4 py-12 text-center text-sm">{children}</p>;
}

function EmptyTable({ colSpan, children }: { colSpan: number; children: string }) {
  return <TableRow><TableCell colSpan={colSpan} className="text-muted-foreground h-24 text-center">{children}</TableCell></TableRow>;
}

function ReportState({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return (
    <div className="space-y-4">
      <DashboardHeader title="Reports" description="Finance and enrollment performance." />
      <DashboardPanel title={title}>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground max-w-md text-sm">{message}</p>
          {retry ? <Button variant="outline" onClick={retry}>Try again</Button> : null}
        </div>
      </DashboardPanel>
    </div>
  );
}

export default ReportsPage;
