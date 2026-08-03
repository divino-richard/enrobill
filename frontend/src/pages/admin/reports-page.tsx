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
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/features/bills/types";
import { discountValueLabel } from "@/features/discounts/types";
import {
  ENROLLMENT_STATUS_META,
  type EnrollmentStatus,
} from "@/features/enrollments/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useReports } from "@/features/reports/hooks";
import { printReport } from "@/features/reports/print";
import type { ReportPeriod } from "@/features/reports/types";
import { useTerms } from "@/features/terms/hooks";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "School year view" },
];

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

  // Defaults to the active term (else the first one) until the picker is touched.
  const defaultTerm =
    terms?.find((term) => term.isActive) ?? terms?.[0] ?? null;
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

  if (termsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (termsError || !terms) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load reports. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetchTerms()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (terms.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            No academic years exist yet — set one up first under Academic
            Years.
          </p>
        </div>
      </div>
    );
  }

  if (reportError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load reports. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (reportLoading || !dataset) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

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
  const maxProgramCount =
    dataset.programMix.length > 0
      ? Math.max(...dataset.programMix.map((row) => row.students))
      : 0;
  const averageBill =
    dataset.summary.billsGenerated > 0
      ? Math.round(dataset.summary.totalBilled / dataset.summary.billsGenerated)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            {selectedTerm?.isActive && (
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                Active term
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Finance and enrollment snapshots for bills, payments, enrollments,
            vouchers, and payment channels.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={selectedTerm ? String(selectedTerm.id) : undefined}
            onValueChange={setSelectedTermId}
          >
            <SelectTrigger className="min-w-44">
              <CalendarRangeIcon className="size-4 text-muted-foreground" />
              <SelectValue placeholder="School year" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((term) => (
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

          <Button
            variant="outline"
            type="button"
            onClick={() =>
              printReport(
                dataset,
                {
                  schoolYear: selectedTerm
                    ? `SY ${selectedTerm.schoolYear}`
                    : "—",
                  periodLabel:
                    PERIOD_OPTIONS.find((option) => option.value === period)
                      ?.label ?? "",
                },
                programLabel,
              )
            }
          >
            <ReceiptTextIcon />
            Export snapshot
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 bg-linear-to-br from-primary/8 via-background to-muted/60">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-background/80">
                {selectedTerm ? `SY ${selectedTerm.schoolYear}` : "—"}
              </Badge>
              <Badge variant="outline" className="bg-background/80">
                {
                  PERIOD_OPTIONS.find((option) => option.value === period)
                    ?.label
                }
              </Badge>
            </div>
            <h2 className="text-base font-semibold tracking-tight">
              Collection posture is at {dataset.summary.collectionRate}% for the
              selected view.
            </h2>
            <p className="text-muted-foreground max-w-xl text-xs">
              Bills are anchored to school year and enrollment records; verified
              payments and voucher credits explain how much has been realized.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:shrink-0">
            <HighlightTile
              label="Snapshot updated"
              value={formatDate(dataset.updatedAt)}
              icon={ClockIcon}
            />
            <HighlightTile
              label="Average bill"
              value={formatPeso(averageBill)}
              icon={ReceiptTextIcon}
            />
            <HighlightTile
              label="Voucher credits"
              value={formatPeso(dataset.summary.voucherCredits)}
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
                  {dataset.topBalances.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-muted-foreground h-24 text-center"
                      >
                        No open balances for this term.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dataset.topBalances.map((row) => (
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
                            <span>{programLabel(row.program)}</span>
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
                          {row.paymentStatus ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                PAYMENT_STATUS_META[row.paymentStatus].className,
                              )}
                            >
                              {PAYMENT_STATUS_META[row.paymentStatus].label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              No payments yet
                            </span>
                          )}
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
                    ))
                  )}
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
                {dataset.enrollmentStatuses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No enrollments recorded for this term yet.
                  </p>
                ) : (
                  dataset.enrollmentStatuses.map((item) => (
                    <MeterRow
                      key={item.status}
                      label={ENROLLMENT_STATUS_META[item.status].label}
                      value={item.count}
                      total={totalEnrollmentCount}
                      badge={`${item.count} students`}
                      meta={
                        totalEnrollmentCount > 0
                          ? `${Math.round((item.count / totalEnrollmentCount) * 100)}%`
                          : "0%"
                      }
                      note={item.note}
                      tone={enrollmentTone(item.status)}
                    />
                  ))
                )}
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
                {dataset.programMix.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No enrollments recorded for this term yet.
                  </p>
                ) : (
                  dataset.programMix.map((row) => (
                    <div key={`${row.program}-${row.yearLevel}`} className="space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{programLabel(row.program)}</p>
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
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent enrollment activity
              </CardTitle>
              <CardDescription>
                The most recently created enrollments for the selected term and
                period.
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
                  {dataset.enrollmentActivity.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground h-24 text-center"
                      >
                        No enrollment activity in this window.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dataset.enrollmentActivity.map((row) => (
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
                            <span>{programLabel(row.program)}</span>
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
                    ))
                  )}
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
                  Vouchers granted at admission and applied against bills this
                  term.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataset.vouchers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No vouchers in the catalog yet.
                  </p>
                ) : (
                  dataset.vouchers.map((item) => (
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
                  ))
                )}
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
                {dataset.channelAudits.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No payment methods configured yet.
                  </p>
                ) : (
                  dataset.channelAudits.map((item) => (
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
                  ))
                )}
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
                  {dataset.creditActivity.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground h-24 text-center"
                      >
                        No credit activity in this window.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dataset.creditActivity.map((row) => (
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
                    ))
                  )}
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
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ClockIcon;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/75 p-2.5 shadow-xs">
      <div className="bg-muted text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="truncate text-sm font-semibold tracking-tight">{value}</p>
      </div>
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
