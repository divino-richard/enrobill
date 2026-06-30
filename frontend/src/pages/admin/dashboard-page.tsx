import { useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  BanknoteIcon,
  BarChart3Icon,
  CalendarRangeIcon,
  CircleFadingArrowUpIcon,
  ClipboardListIcon,
  ClockIcon,
  GraduationCapIcon,
  ReceiptTextIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { StatTile } from "@/components/stat-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { StaffDashboard } from "@/features/dashboard/api";
import { useAuthStore } from "@/features/auth/store";
import { useStaffDashboard } from "@/features/dashboard/hooks";
import { semesterLabel } from "@/features/terms/types";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "violet" | "sky";

interface DashboardMetric {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  accent?: string;
}

interface DashboardAction {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
}

interface QueueItem {
  label: string;
  note: string;
  value: number;
  status: string;
  tone: Tone;
  icon: LucideIcon;
  to: string;
  actionLabel: string;
}

const compactPesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const compactNumberFormatter = new Intl.NumberFormat("en-PH", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const countFormatter = new Intl.NumberFormat("en-PH");

const admissionsChartConfig = {
  submitted: {
    label: "Submitted",
    color: "var(--color-chart-5)",
  },
  admitted: {
    label: "Admitted",
    color: "var(--color-chart-3)",
  },
  enrolled: {
    label: "Enrolled",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

const financeChartConfig = {
  billed: {
    label: "Billed",
    color: "var(--color-chart-4)",
  },
  collected: {
    label: "Collected",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch } = useStaffDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <Skeleton className="h-[25rem] rounded-2xl" />
          <Skeleton className="h-[25rem] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn&apos;t load the dashboard. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = data.role === "admin";
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : undefined;
  const openTerm = data.openTerm;
  const finance = data.finance;
  const operations = data.operations;
  const enrollment = data.enrollment;

  const followUpAccounts = finance.bills.unpaid + finance.bills.partial;
  const collectionRateLabel = formatPercent(finance.collectionRate);
  const outstandingShare = percentageOf(finance.outstanding, finance.billed);

  const metrics: DashboardMetric[] = [
    {
      label: "Collection rate",
      value: collectionRateLabel,
      hint: `${formatPeso(finance.collected)} collected from ${formatPeso(finance.billed)} billed`,
      icon: TrendingUpIcon,
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Outstanding",
      value: formatPeso(finance.outstanding),
      hint: `${outstandingShare}% of billed value remains open`,
      icon: BanknoteIcon,
      accent: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Pending verifications",
      value: formatCount(finance.pendingPayments),
      hint: "Submitted payment proofs awaiting review",
      icon: ClockIcon,
      accent: "text-violet-600 dark:text-violet-400",
    },
    {
      label: "Pending enrollments",
      value: formatCount(operations.pendingEnrollments),
      hint: "Enrollment records still waiting on billing flow",
      icon: ReceiptTextIcon,
      accent: "text-primary",
    },
    isAdmin
      ? {
          label: "Admissions queue",
          value: formatCount(enrollment?.applications.pending ?? 0),
          hint: `${formatCount(enrollment?.applications.total ?? 0)} total applications tracked`,
          icon: ClipboardListIcon,
          accent: "text-sky-600 dark:text-sky-400",
        }
      : {
          label: "Follow-up accounts",
          value: formatCount(followUpAccounts),
          hint: `${formatCount(finance.bills.unpaid)} unpaid · ${formatCount(finance.bills.partial)} partial`,
          icon: WalletIcon,
          accent: "text-sky-600 dark:text-sky-400",
        },
  ];

  const primaryAction = getPrimaryAction({
    isAdmin,
    openTerm,
    finance,
    operations,
    enrollment,
  });

  const queueItems = buildQueueItems({
    isAdmin,
    finance,
    operations,
    enrollment,
    followUpAccounts,
  });

  const activeQueueCount = queueItems.filter((item) => item.value > 0).length;
  const monitoredQueueCount = queueItems.reduce(
    (total, item) => total + item.value,
    0,
  );

  const summaryAlert = getSummaryAlert({
    openTerm,
    finance,
    operations,
    enrollment,
  });

  const PrimaryActionIcon = primaryAction.icon;

  return (
    <div className="space-y-6">
      <Card className="border-primary/10 bg-gradient-to-br from-primary/8 via-background to-muted/60">
        <CardContent className="grid gap-4 p-4 lg:p-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.9fr)] xl:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-background/80">
                {isAdmin ? "Admin dashboard" : "Cashier dashboard"}
              </Badge>
              <Badge variant="outline" className="bg-background/80">
                {openTerm ? `SY ${openTerm.schoolYear}` : "No active term"}
              </Badge>
              {openTerm && (
                <Badge variant="outline" className="bg-background/80">
                  {semesterLabel(openTerm.semester)}
                </Badge>
              )}
              {isAdmin && openTerm && (
                <Badge
                  variant="outline"
                  className={cn(
                    openTerm.admissionOpen
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-background/80 text-muted-foreground",
                  )}
                >
                  {openTerm.admissionOpen ? "Admissions open" : "Admissions closed"}
                </Badge>
              )}
              {isAdmin && openTerm && (
                <Badge
                  variant="outline"
                  className={cn(
                    openTerm.progressionOpen
                      ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-background/80 text-muted-foreground",
                  )}
                >
                  {openTerm.progressionOpen
                    ? "Progression open"
                    : "Progression closed"}
                </Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                Dashboard
              </h1>
              <p className="text-muted-foreground max-w-3xl text-sm leading-5">
                {isAdmin
                  ? `${firstName ? `${firstName}, ` : ""}this view keeps admissions, enrollment, and finance pressure on one screen so the next decision is obvious.`
                  : `${firstName ? `${firstName}, ` : ""}this view keeps collection posture, verification load, and billing backlog in one place.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(primaryAction.to)}>
                <PrimaryActionIcon />
                {primaryAction.label}
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin/reports")}>
                <BarChart3Icon />
                Open reports
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
            <HighlightTile
              label="Current term"
              value={
                openTerm
                  ? `SY ${openTerm.schoolYear}`
                  : "Standby"
              }
              hint={
                openTerm
                  ? semesterLabel(openTerm.semester)
                  : "Activate an academic year to populate the workspace"
              }
              icon={CalendarRangeIcon}
            />
            <HighlightTile
              label="Action lanes"
              value={String(activeQueueCount)}
              hint={`${formatCount(monitoredQueueCount)} records across monitored queues`}
              icon={ClipboardListIcon}
              accent="text-sky-600 dark:text-sky-400"
            />
            <HighlightTile
              label="Open exposure"
              value={formatCompactPeso(finance.outstanding)}
              hint={`${formatCount(followUpAccounts)} accounts still need follow-up`}
              icon={BanknoteIcon}
              accent="text-amber-600 dark:text-amber-400"
            />
          </div>
        </CardContent>
      </Card>

      {summaryAlert && (
        <Alert className={cn("rounded-xl border", summaryAlert.className)}>
          <summaryAlert.icon className="size-4 shrink-0" />
          <AlertTitle>{summaryAlert.title}</AlertTitle>
          <AlertDescription className={summaryAlert.descriptionClassName}>
            {summaryAlert.description}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <StatTile key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        {isAdmin ? (
          <AdmissionsTrendCard trend={data.trend.admissions} />
        ) : (
          <FinanceTrendCard trend={data.trend.finance} />
        )}

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">Action queue</CardTitle>
            <CardDescription>
              Only the workflows that currently deserve dashboard space.
            </CardDescription>
            <CardAction>
              <Badge variant="outline" className="bg-background/80">
                {activeQueueCount} active lane{activeQueueCount === 1 ? "" : "s"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-4">
            {queueItems.map((item) => (
              <QueueRow
                key={item.label}
                item={item}
                onOpen={() => navigate(item.to)}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdmissionsTrendCard({
  trend,
}: {
  trend: StaffDashboard["trend"]["admissions"];
}) {
  const currentMonth = trend[trend.length - 1] ?? {
    month: "Current",
    submitted: 0,
    admitted: 0,
    enrolled: 0,
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">Admissions and enrollment trend</CardTitle>
        <CardDescription>
          Six-month movement across submitted applications, admitted students,
          and completed enrollments.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="bg-background/80">
            Last 6 months
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(admissionsChartConfig).map(([key, config]) => (
            <LegendChip key={key} label={String(config.label)} color={config.color} />
          ))}
        </div>

        <div className="h-64">
          <ChartContainer config={admissionsChartConfig}>
            <LineChart
              accessibilityLayer
              data={trend}
              margin={{ left: 8, right: 12, top: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Line
                dataKey="submitted"
                type="monotone"
                stroke="var(--color-submitted)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="admitted"
                type="monotone"
                stroke="var(--color-admitted)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="enrolled"
                type="monotone"
                stroke="var(--color-enrolled)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <SnapshotTile
            label={`${currentMonth.month} submitted`}
            value={formatCount(currentMonth.submitted)}
            hint="Applications received"
          />
          <SnapshotTile
            label={`${currentMonth.month} admitted`}
            value={formatCount(currentMonth.admitted)}
            hint="Students moved into admitted status"
            accent="text-sky-600 dark:text-sky-400"
          />
          <SnapshotTile
            label={`${currentMonth.month} enrolled`}
            value={formatCount(currentMonth.enrolled)}
            hint="Students completed enrollment"
            accent="text-primary"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceTrendCard({
  trend,
}: {
  trend: StaffDashboard["trend"]["finance"];
}) {
  const currentMonth = trend[trend.length - 1] ?? {
    month: "Current",
    billed: 0,
    collected: 0,
  };
  const gap = Math.max(currentMonth.billed - currentMonth.collected, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">Billing and collection trend</CardTitle>
        <CardDescription>
          Six-month movement across billed value and verified collections.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="bg-background/80">
            Last 6 months
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(financeChartConfig).map(([key, config]) => (
            <LegendChip key={key} label={String(config.label)} color={config.color} />
          ))}
        </div>

        <div className="h-64">
          <ChartContainer config={financeChartConfig}>
            <LineChart
              accessibilityLayer
              data={trend}
              margin={{ left: 8, right: 12, top: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                tickFormatter={(value) => compactNumberFormatter.format(value)}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatPeso(Number(value))}
                  />
                }
              />
              <Line
                dataKey="billed"
                type="monotone"
                stroke="var(--color-billed)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="collected"
                type="monotone"
                stroke="var(--color-collected)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <SnapshotTile
            label={`${currentMonth.month} billed`}
            value={formatCompactPeso(currentMonth.billed)}
            hint="New billing issued"
          />
          <SnapshotTile
            label={`${currentMonth.month} collected`}
            value={formatCompactPeso(currentMonth.collected)}
            hint="Verified collections posted"
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <SnapshotTile
            label={`${currentMonth.month} gap`}
            value={formatCompactPeso(gap)}
            hint="Billing not yet realized"
            accent="text-amber-600 dark:text-amber-400"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-primary",
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/75 p-3 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className="text-base font-semibold tracking-tight">{value}</p>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        <div
          className={cn(
            "bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg",
            accent,
          )}
        >
          <Icon className="size-4.5" />
        </div>
      </div>
    </div>
  );
}

function LegendChip({ label, color }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs">
      <span
        className="inline-flex size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function SnapshotTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className={cn("mt-2 text-lg font-semibold tracking-tight", accent)}>
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </div>
  );
}

function QueueRow({
  item,
  onOpen,
}: {
  item: QueueItem;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              "bg-muted/60 flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70",
              toneTextClass(item.tone),
            )}
          >
            <item.icon className="size-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.label}</p>
              <Badge variant="outline" className={cn(toneBadgeClass(item.tone))}>
                {item.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              {item.note}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          <p className="text-lg font-semibold tracking-tight tabular-nums">
            {formatCount(item.value)}
          </p>
          <Button variant="link" className="h-auto p-0" onClick={onOpen}>
            {item.actionLabel}
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getPrimaryAction({
  isAdmin,
  openTerm,
  finance,
  operations,
  enrollment,
}: {
  isAdmin: boolean;
  openTerm: StaffDashboard["openTerm"];
  finance: StaffDashboard["finance"];
  operations: StaffDashboard["operations"];
  enrollment: StaffDashboard["enrollment"];
}): DashboardAction {
  if (!openTerm) {
    return isAdmin
      ? {
          label: "Open academic years",
          description:
            "An active academic year is required before the operational dashboard becomes meaningful.",
          to: "/admin/terms",
          icon: CalendarRangeIcon,
        }
      : {
          label: "Open billing",
          description:
            "Billing remains the most relevant workspace while the term is inactive.",
          to: "/admin/billing",
          icon: BanknoteIcon,
        };
  }

  if (finance.pendingPayments > 0) {
    return {
      label: "Review payments",
      description:
        "Pending payment verification is the most time-sensitive finance queue.",
      to: "/admin/billing",
      icon: BanknoteIcon,
    };
  }

  if (isAdmin && (enrollment?.applications.pending ?? 0) > 0) {
    return {
      label: "Review applications",
      description:
        "Admissions review is the next academic queue to clear.",
      to: "/admin/applications",
      icon: ClipboardListIcon,
    };
  }

  if (operations.pendingEnrollments > 0) {
    return {
      label: "Process enrollments",
      description:
        "Pending enrollments need billing movement before they can progress.",
      to: "/admin/enrollments",
      icon: ReceiptTextIcon,
    };
  }

  if (isAdmin && (enrollment?.sections.unsectioned ?? 0) > 0) {
    return {
      label: "Assign sections",
      description:
        "Some enrolled students still need section placement.",
      to: "/admin/sections",
      icon: GraduationCapIcon,
    };
  }

  if (isAdmin && enrollment?.progression.open) {
    return {
      label: "Check progression",
      description:
        "Progression is open and should stay visible while closeout is active.",
      to: "/admin/progression",
      icon: CircleFadingArrowUpIcon,
    };
  }

  return {
    label: "Open reports",
    description:
      "The live dashboard is stable, so reports are the best next place to inspect detail.",
    to: "/admin/reports",
    icon: BarChart3Icon,
  };
}

function buildQueueItems({
  isAdmin,
  finance,
  operations,
  enrollment,
  followUpAccounts,
}: {
  isAdmin: boolean;
  finance: StaffDashboard["finance"];
  operations: StaffDashboard["operations"];
  enrollment: StaffDashboard["enrollment"];
  followUpAccounts: number;
}): QueueItem[] {
  const items: QueueItem[] = [
    {
      label: "Payment verification",
      note:
        finance.pendingPayments > 0
          ? "Submitted payment proofs are waiting to be verified and posted."
          : "No submitted payment proofs are waiting right now.",
      value: finance.pendingPayments,
      status: finance.pendingPayments > 0 ? "Immediate review" : "Clear",
      tone: "violet",
      icon: ClockIcon,
      to: "/admin/billing",
      actionLabel: "Open billing",
    },
    {
      label: "Pending enrollments",
      note:
        operations.pendingEnrollments > 0
          ? "Enrollment records still need billing movement before they can advance."
          : "No pending enrollment records are blocked on billing.",
      value: operations.pendingEnrollments,
      status: operations.pendingEnrollments > 0 ? "Queue active" : "Clear",
      tone: "primary",
      icon: ReceiptTextIcon,
      to: "/admin/enrollments",
      actionLabel: "Open enrollments",
    },
    {
      label: "Receivable follow-up",
      note: `${formatCount(finance.bills.unpaid)} unpaid and ${formatCount(finance.bills.partial)} partially paid accounts remain open.`,
      value: followUpAccounts,
      status: followUpAccounts > 0 ? "Follow up" : "Healthy",
      tone: "warning",
      icon: WalletIcon,
      to: "/admin/billing",
      actionLabel: "Open billing",
    },
  ];

  if (!isAdmin || !enrollment) {
    return items;
  }

  items.push(
    {
      label: "Admissions review",
      note: `${formatCount(enrollment.applications.submitted)} submitted, ${formatCount(enrollment.applications.underReview)} under review, ${formatCount(enrollment.applications.returned)} returned.`,
      value: enrollment.applications.pending,
      status:
        enrollment.applications.pending > 0 ? "Queue active" : "Clear",
      tone: "sky",
      icon: ClipboardListIcon,
      to: "/admin/applications",
      actionLabel: "Open applications",
    },
    {
      label: "Section placement",
      note:
        enrollment.sections.unsectioned > 0
          ? "Some enrolled students still need a section assignment."
          : "All enrolled students currently have section placement.",
      value: enrollment.sections.unsectioned,
      status:
        enrollment.sections.unsectioned > 0 ? "Placement needed" : "Clear",
      tone: "warning",
      icon: GraduationCapIcon,
      to: "/admin/sections",
      actionLabel: "Open sections",
    },
  );

  if (enrollment.progression.open) {
    items.push({
      label: "Progression closeout",
      note: enrollment.progression.nextYearReady
        ? "Progression is open and the next academic year already exists."
        : "Progression is open, but the next academic year still needs to be prepared.",
      value: enrollment.progression.pendingDecisions,
      status:
        enrollment.progression.pendingDecisions > 0
          ? "Pending decisions"
          : "Open and clear",
      tone: "primary",
      icon: CircleFadingArrowUpIcon,
      to: "/admin/progression",
      actionLabel: "Open progression",
    });
  }

  return items;
}

function getSummaryAlert({
  openTerm,
  finance,
  operations,
  enrollment,
}: {
  openTerm: StaffDashboard["openTerm"];
  finance: StaffDashboard["finance"];
  operations: StaffDashboard["operations"];
  enrollment: StaffDashboard["enrollment"];
}) {
  if (!openTerm) {
    return {
      title: "No active academic year",
      description:
        "Activate an academic year before relying on this dashboard as the operational control surface.",
      icon: CalendarRangeIcon,
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
      descriptionClassName: "text-amber-800 dark:text-amber-300",
    };
  }

  if (finance.pendingPayments > 0) {
    return {
      title: `${formatCount(finance.pendingPayments)} payment${finance.pendingPayments === 1 ? "" : "s"} awaiting verification`,
      description:
        "Student payments have been submitted but are not yet reflected in posted collections.",
      icon: TriangleAlertIcon,
      className:
        "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
      descriptionClassName: "text-violet-800 dark:text-violet-300",
    };
  }

  if ((enrollment?.applications.pending ?? 0) > 0) {
    return {
      title: `${formatCount(enrollment?.applications.pending ?? 0)} admissions record${(enrollment?.applications.pending ?? 0) === 1 ? "" : "s"} need review`,
      description:
        "Applications are still moving through admission review and should stay visible.",
      icon: ClipboardListIcon,
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
      descriptionClassName: "text-sky-800 dark:text-sky-300",
    };
  }

  if (operations.pendingEnrollments > 0) {
    return {
      title: `${formatCount(operations.pendingEnrollments)} enrollment${operations.pendingEnrollments === 1 ? "" : "s"} still waiting on billing movement`,
      description:
        "Enrollment and finance are not fully synchronized yet for the active term.",
      icon: ReceiptTextIcon,
      className:
        "border-primary/20 bg-primary/8 text-primary",
      descriptionClassName: "text-primary/80",
    };
  }

  if ((enrollment?.sections.unsectioned ?? 0) > 0) {
    return {
      title: `${formatCount(enrollment?.sections.unsectioned ?? 0)} enrolled student${(enrollment?.sections.unsectioned ?? 0) === 1 ? "" : "s"} still need section placement`,
      description:
        "Academic operations are otherwise stable, but sectioning still needs attention.",
      icon: GraduationCapIcon,
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
      descriptionClassName: "text-amber-800 dark:text-amber-300",
    };
  }

  return null;
}

function toneTextClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "violet":
      return "text-violet-600 dark:text-violet-400";
    case "sky":
      return "text-sky-600 dark:text-sky-400";
    case "primary":
    default:
      return "text-primary";
  }
}

function toneBadgeClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300";
    case "primary":
    default:
      return "border-primary/20 bg-primary/8 text-primary";
  }
}

function percentageOf(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatCompactPeso(value: number) {
  return compactPesoFormatter.format(value);
}

function formatCount(value: number) {
  return countFormatter.format(value);
}

export default DashboardPage;
