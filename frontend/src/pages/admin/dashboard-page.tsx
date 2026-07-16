import { useNavigate } from "react-router-dom";
import {
  BanknoteIcon,
  BarChart3Icon,
  CalendarRangeIcon,
  CircleFadingArrowUpIcon,
  ClipboardListIcon,
  ClockIcon,
  GraduationCapIcon,
  InfoIcon,
  ReceiptTextIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
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
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// The widest-apart pair of the theme ramp that still clears both the light and
// the dark surface; the steps outside these two wash out against one or other.
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

// Every other step of the theme ramp, so the ring reads dark (settled) to light
// (untouched) with as much room between neighbours as the ramp allows. The steps
// are close enough that the legend below is what ties a colour to a status.
const billStatusChartConfig = {
  paid: {
    label: "Paid",
    color: "var(--color-chart-5)",
  },
  partial: {
    label: "Partially paid",
    color: "var(--color-chart-3)",
  },
  unpaid: {
    label: "Unpaid",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

const billStatusKeys = ["paid", "partial", "unpaid"] as const;

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
      <Card className="p-0 py-2 border-primary/10 bg-gradient-to-br from-primary/8 via-background to-muted/60">
        <CardContent className="grid gap-4 p-4 lg:p-5 xl:grid-cols-2 xl:items-center">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-background/80">
                {isAdmin ? "Admin dashboard" : "Cashier dashboard"}
              </Badge>
              <Badge variant="outline" className="bg-background/80">
                {openTerm ? `SY ${openTerm.schoolYear}` : "No active term"}
              </Badge>
              {isAdmin && openTerm && (
                <Badge
                  variant="outline"
                  className={cn(
                    openTerm.admissionOpen
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-background/80 text-muted-foreground",
                  )}
                >
                  {openTerm.admissionOpen
                    ? "Admissions open"
                    : "Admissions closed"}
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

            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Dashboard
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help"
                    onClick={(e) => e.preventDefault()}
                  >
                    <InfoIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-pretty">
                  {isAdmin
                    ? `${firstName ? `${firstName}, ` : ""}this view keeps admissions, enrollment, and finance pressure on one screen so the next decision is obvious.`
                    : `${firstName ? `${firstName}, ` : ""}this view keeps collection posture, verification load, and billing backlog in one place.`}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(primaryAction.to)}>
                <PrimaryActionIcon />
                {primaryAction.label}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/reports")}
              >
                <BarChart3Icon />
                Open reports
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
            <HighlightTile
              label="Current term"
              value={openTerm ? `SY ${openTerm.schoolYear}` : "Standby"}
              hint={
                openTerm
                  ? "Admissions and billing are tied to this active school year"
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

      <div className="space-y-6">
        {isAdmin ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <AdmissionsTrendCard trend={data.trend.admissions} />
              <BillStatusCard bills={finance.bills} />
            </div>
            <FinanceTrendCard trend={data.trend.finance} />
          </>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <FinanceTrendCard trend={data.trend.finance} />
            <BillStatusCard bills={finance.bills} />
          </div>
        )}
      </div>
    </div>
  );
}

function AdmissionsTrendCard({
  trend,
}: {
  trend: StaffDashboard["trend"]["admissions"];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base flex items-center gap-3">
          Admissions and enrollment trend
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help"
                onClick={(e) => e.preventDefault()}
              >
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-pretty">
              Six-month movement across submitted applications, admitted
              students, and completed enrollments.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="bg-background/80">
            Last 6 months
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(admissionsChartConfig).map(([key, config]) => (
            <LegendChip
              key={key}
              label={String(config.label)}
              color={config.color}
            />
          ))}
        </div>

        <div className="h-54">
          <ChartContainer config={admissionsChartConfig}>
            <AreaChart
              accessibilityLayer
              data={trend}
              margin={{ left: 8, right: 12, top: 8 }}
            >
              <defs>
                <AreaFillGradient
                  id="fill-submitted"
                  color="var(--color-submitted)"
                />
                <AreaFillGradient
                  id="fill-admitted"
                  color="var(--color-admitted)"
                />
                <AreaFillGradient
                  id="fill-enrolled"
                  color="var(--color-enrolled)"
                />
              </defs>
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
              <Area
                dataKey="submitted"
                type="monotone"
                stroke="var(--color-submitted)"
                strokeWidth={2.5}
                fill="url(#fill-submitted)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                dataKey="admitted"
                type="monotone"
                stroke="var(--color-admitted)"
                strokeWidth={2.5}
                fill="url(#fill-admitted)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                dataKey="enrolled"
                type="monotone"
                stroke="var(--color-enrolled)"
                strokeWidth={2.5}
                fill="url(#fill-enrolled)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ChartContainer>
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
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base flex items-center gap-3">
          Billing and collection trend
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help"
                onClick={(e) => e.preventDefault()}
              >
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-pretty">
              Twelve-month movement across billed value and verified collections.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="bg-background/80">
            Last 12 months
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(financeChartConfig).map(([key, config]) => (
            <LegendChip
              key={key}
              label={String(config.label)}
              color={config.color}
            />
          ))}
        </div>

        <div className="h-54">
          <ChartContainer config={financeChartConfig}>
            <BarChart
              accessibilityLayer
              data={trend}
              margin={{ left: 8, right: 12, top: 8 }}
              barGap={2}
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
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatPeso(Number(value))}
                  />
                }
              />
              <Bar
                dataKey="billed"
                fill="var(--color-billed)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
              <Bar
                dataKey="collected"
                fill="var(--color-collected)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function BillStatusCard({
  bills,
}: {
  bills: StaffDashboard["finance"]["bills"];
}) {
  const total = bills.total;
  const data = [
    {
      label: "Bills",
      paid: bills.paid,
      partial: bills.partial,
      unpaid: bills.unpaid,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base flex items-center gap-3">
          Bill status mix
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help"
                onClick={(e) => e.preventDefault()}
              >
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-pretty">
              How many accounts sit at each payment stage. The metric tiles
              above measure the same term in pesos; this one measures it in
              accounts.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="bg-background/80">
            {formatCount(total)} bill{total === 1 ? "" : "s"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">
            No bills have been generated for this term yet.
          </p>
        ) : (
          <>
            {/* A half ring only fills the top of its box, so the centre is
                pushed down to keep the arc close to the legend below. */}
            <div className="mx-auto h-40 w-full max-w-[250px]">
              <ChartContainer config={billStatusChartConfig}>
                <RadialBarChart
                  data={data}
                  cy="95%"
                  endAngle={180}
                  innerRadius={80}
                  outerRadius={130}
                >
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  {/* recharts 3 sizes the angle axis from a single series
                      rather than the stack, which drops every segment after
                      the first unless the total domain is given here. */}
                  <PolarAngleAxis
                    type="number"
                    domain={[0, total]}
                    tick={false}
                    axisLine={false}
                  />
                  <PolarRadiusAxis
                    tick={false}
                    tickLine={false}
                    axisLine={false}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (
                          !viewBox ||
                          !("cx" in viewBox) ||
                          !("cy" in viewBox)
                        ) {
                          return null;
                        }

                        const cx = viewBox.cx ?? 0;
                        const cy = viewBox.cy ?? 0;

                        return (
                          <text x={cx} y={cy} textAnchor="middle">
                            <tspan
                              x={cx}
                              y={cy - 16}
                              className="fill-foreground text-2xl font-semibold"
                            >
                              {formatCount(total)}
                            </tspan>
                            <tspan
                              x={cx}
                              y={cy + 4}
                              className="fill-muted-foreground text-xs"
                            >
                              bill{total === 1 ? "" : "s"}
                            </tspan>
                          </text>
                        );
                      }}
                    />
                  </PolarRadiusAxis>
                  <RadialBar
                    dataKey="paid"
                    stackId="bills"
                    cornerRadius={5}
                    fill="var(--color-paid)"
                    className="stroke-transparent stroke-2"
                  />
                  <RadialBar
                    dataKey="partial"
                    stackId="bills"
                    cornerRadius={5}
                    fill="var(--color-partial)"
                    className="stroke-transparent stroke-2"
                  />
                  <RadialBar
                    dataKey="unpaid"
                    stackId="bills"
                    cornerRadius={5}
                    fill="var(--color-unpaid)"
                    className="stroke-transparent stroke-2"
                  />
                </RadialBarChart>
              </ChartContainer>
            </div>

            <div className="flex flex-wrap mx-auto w-fit gap-2">
              {billStatusKeys.map((key) => (
                <LegendChip
                  key={key}
                  label={`${billStatusChartConfig[key].label} · ${formatCount(bills[key])} (${percentageOf(bills[key], total)}%)`}
                  color={billStatusChartConfig[key].color}
                />
              ))}
            </div>
          </>
        )}
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
          <div className="flex gap-2 items-center">
            <p className="text-base font-semibold tracking-tight">{value}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help"
                  onClick={(e) => e.preventDefault()}
                >
                  <InfoIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-pretty">
                {hint}
              </TooltipContent>
            </Tooltip>
          </div>
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

function AreaFillGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.15} />
      <stop offset="95%" stopColor={color} stopOpacity={0.01} />
    </linearGradient>
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
      description: "Admissions review is the next academic queue to clear.",
      to: "/admin/applications",
      icon: ClipboardListIcon,
    };
  }

  if (operations.pendingEnrollments > 0) {
    return {
      label: "View enrollments",
      description:
        "Pending enrollments need billing movement before they can progress.",
      to: "/admin/enrollments",
      icon: ReceiptTextIcon,
    };
  }

  if (isAdmin && (enrollment?.sections.unsectioned ?? 0) > 0) {
    return {
      label: "Assign sections",
      description: "Some enrolled students still need section placement.",
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
      status: enrollment.applications.pending > 0 ? "Queue active" : "Clear",
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
      className: "border-primary/20 bg-primary/8 text-primary",
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
