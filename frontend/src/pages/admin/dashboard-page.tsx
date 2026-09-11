import { useNavigate } from "react-router-dom";
import { BarChart3Icon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  DashboardAttention,
  DashboardError,
  DashboardHeader,
  DashboardLoading,
  DashboardMetricStrip,
  DashboardPanel,
  DashboardQueue,
  type DashboardAttentionItem,
  type DashboardMetric,
  type DashboardQueueItem,
} from "@/components/dashboard/dashboard-primitives";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { StaffDashboard } from "@/features/dashboard/api";
import { useStaffDashboard } from "@/features/dashboard/hooks";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("en-PH");
const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

const admissionsConfig = {
  submitted: { label: "Submitted", color: "var(--color-primary)" },
  admitted: { label: "Admitted", color: "var(--color-chart-2)" },
  enrolled: { label: "Enrolled", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

const financeConfig = {
  billed: { label: "Billed", color: "var(--color-primary)" },
  collected: { label: "Collected", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const billConfig = {
  value: { label: "Bills", color: "var(--color-primary)" },
} satisfies ChartConfig;

export default function DashboardPage() {
  const navigate = useNavigate();
  const query = useStaffDashboard();

  if (query.isLoading) return <DashboardLoading />;
  if (query.isError || !query.data) return <DashboardError retry={() => query.refetch()} />;

  const data = query.data;
  const isAdmin = data.role === "admin";
  const finance = data.finance;
  const enrollment = data.enrollment;
  const openAccounts = finance.bills.unpaid + finance.bills.partial;
  const enrolled = enrollment?.students.enrolled ?? 0;
  const applicationTotal = enrollment?.applications.total ?? 0;
  const conversion = applicationTotal ? Math.min(100, Math.round((enrolled / applicationTotal) * 100)) : 0;
  const queueItems = buildQueue(data, navigate);
  const attentionItems: DashboardAttentionItem[] = queueItems.slice(0, 3).map((item) => ({
    label: item.label,
    detail: item.detail,
    value: item.value ?? 0,
    onAction: item.onAction,
    tone: item.tone === "danger" ? "danger" : item.tone === "warning" ? "warning" : "primary",
  }));
  const attentionTotal = attentionItems.reduce((sum, item) => sum + Number(item.value), 0);
  const admissionsTrend = data.trend.admissions;
  const financeTrend = data.trend.finance;
  const metrics: DashboardMetric[] = isAdmin
    ? [
        { label: "Enrolled students", value: number.format(enrolled), detail: "Current academic year", trend: admissionsTrend.map((item) => item.enrolled), tone: "primary" },
        { label: "Collection rate", value: `${finance.collectionRate}%`, detail: `${formatPeso(finance.collected)} verified`, trend: financeTrend.map((item) => item.collected), tone: "success" },
        { label: "Outstanding", value: formatPeso(finance.outstanding), detail: `${number.format(openAccounts)} open accounts`, trend: financeTrend.map((item) => item.billed - item.collected), tone: finance.outstanding ? "warning" : "success" },
        { label: "Application conversion", value: `${conversion}%`, detail: `${number.format(enrolled)} enrolled of ${number.format(applicationTotal)}`, trend: admissionsTrend.map((item) => item.enrolled), tone: "primary" },
      ]
    : [
        { label: "Collected", value: formatPeso(finance.collected), detail: "Verified payments", trend: financeTrend.map((item) => item.collected), tone: "success" },
        { label: "Collection rate", value: `${finance.collectionRate}%`, detail: `${formatPeso(finance.billed)} billed`, trend: financeTrend.map((item) => item.collected), tone: "primary" },
        { label: "Outstanding", value: formatPeso(finance.outstanding), detail: `${number.format(openAccounts)} open accounts`, trend: financeTrend.map((item) => item.billed - item.collected), tone: finance.outstanding ? "warning" : "success" },
        { label: "Bills tracked", value: number.format(finance.bills.total), detail: `${number.format(finance.pendingPayments)} proofs to verify`, tone: finance.pendingPayments ? "warning" : "success" },
      ];

  return (
    <div className="space-y-3">
      <DashboardHeader
        description={isAdmin ? "Admissions, enrollment, and finance at a glance" : "Collections, verification, and billing follow-up at a glance"}
        actions={<><span className="inline-flex h-9 items-center rounded-md bg-card px-3 text-xs font-semibold shadow-xs ring-1 ring-foreground/10">{data.openTerm ? `SY ${data.openTerm.schoolYear}` : "No active year"}</span><Button variant="outline" onClick={() => navigate("/admin/reports")}><BarChart3Icon />Open reports</Button></>}
      />

      <DashboardAttention summary={attentionTotal ? `${number.format(attentionTotal)} records` : "All clear"} items={attentionItems} />
      <DashboardMetricStrip metrics={metrics} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.42fr)_minmax(18rem,.78fr)]">
        {isAdmin ? <AdmissionsTrend data={admissionsTrend} conversion={conversion} /> : <FinanceTrend data={financeTrend} rate={finance.collectionRate} />}
        <DashboardPanel title="Operational queue" action={<button type="button" className="text-primary text-xs font-semibold" onClick={() => navigate(isAdmin ? "/admin/applications" : "/admin/billing")}>View all</button>}>
          <DashboardQueue items={queueItems} />
        </DashboardPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {isAdmin && enrollment ? <ApplicationFunnel enrollment={enrollment} /> : <BillStatus finance={finance} />}
        <Readiness data={data} />
      </div>
    </div>
  );
}

function AdmissionsTrend({ data, conversion }: { data: StaffDashboard["trend"]["admissions"]; conversion: number }) {
  return (
    <DashboardPanel title="Admissions and enrollment trend" description="Last 6 months">
      <div className="px-4 pt-3"><ChartLegend items={[{ label: "Submitted", color: "bg-primary" }, { label: "Admitted", color: "bg-chart-2" }, { label: "Enrolled", color: "bg-chart-3" }]} /></div>
      <div className="h-64 px-3 pt-2">
        <ChartContainer config={admissionsConfig}>
          <AreaChart accessibilityLayer data={data} margin={{ left: 2, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area dataKey="submitted" type="monotone" stroke="var(--color-submitted)" fill="var(--color-submitted)" fillOpacity={0.09} strokeWidth={2.5} />
            <Area dataKey="admitted" type="monotone" stroke="var(--color-admitted)" fill="transparent" strokeWidth={2.25} />
            <Area dataKey="enrolled" type="monotone" stroke="var(--color-enrolled)" fill="transparent" strokeWidth={2.25} />
          </AreaChart>
        </ChartContainer>
      </div>
      <div className="mx-4 flex flex-wrap justify-between gap-2 border-t py-3 text-xs"><strong>{conversion}% application-to-enrollment conversion</strong><span className="text-muted-foreground">Current academic year</span></div>
    </DashboardPanel>
  );
}

function FinanceTrend({ data, rate }: { data: StaffDashboard["trend"]["finance"]; rate: number }) {
  return (
    <DashboardPanel title="Billing and collection trend" description="Last 12 months">
      <div className="px-4 pt-3"><ChartLegend items={[{ label: "Billed", color: "bg-primary" }, { label: "Collected", color: "bg-chart-2" }]} /></div>
      <div className="h-64 px-3 pt-2">
        <ChartContainer config={financeConfig}>
          <BarChart accessibilityLayer data={data} margin={{ left: 2, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={(value) => compact.format(Number(value))} tickLine={false} axisLine={false} width={42} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatPeso(Number(value))} />} />
            <Bar dataKey="billed" fill="var(--color-billed)" radius={[3, 3, 0, 0]} maxBarSize={20} />
            <Bar dataKey="collected" fill="var(--color-collected)" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ChartContainer>
      </div>
      <div className="mx-4 flex flex-wrap justify-between gap-2 border-t py-3 text-xs"><strong>{rate}% collection rate</strong><span className="text-muted-foreground">Verified payments only</span></div>
    </DashboardPanel>
  );
}

function ApplicationFunnel({ enrollment }: { enrollment: NonNullable<StaffDashboard["enrollment"]> }) {
  const applications = enrollment.applications;
  const submitted = Math.max(applications.total - applications.draft, 0);
  const reviewed = applications.underReview + applications.returned + applications.accepted + applications.rejected;
  const stages = [
    { label: "Submitted", value: submitted },
    { label: "Reviewed", value: reviewed },
    { label: "Admitted", value: applications.accepted },
    { label: "Enrolled", value: enrollment.students.enrolled },
  ];
  const maximum = Math.max(...stages.map((stage) => stage.value), 1);

  return <DashboardPanel title="Application funnel" description="Current school year"><div className="space-y-3 p-4">{stages.map((stage, index) => <div key={stage.label} className="grid grid-cols-[5rem_minmax(0,1fr)_2.25rem] items-center gap-3 text-xs"><span className="text-muted-foreground">{stage.label}</span><div className="bg-muted h-2.5"><div className={cn("bg-primary h-full", index === stages.length - 1 && "bg-chart-3")} style={{ width: `${Math.max((stage.value / maximum) * 100, stage.value ? 4 : 0)}%` }} /></div><strong className="text-right tabular-nums">{number.format(stage.value)}</strong></div>)}</div></DashboardPanel>;
}

function BillStatus({ finance }: { finance: StaffDashboard["finance"] }) {
  const data = [{ status: "Paid", value: finance.bills.paid }, { status: "Partial", value: finance.bills.partial }, { status: "Unpaid", value: finance.bills.unpaid }];
  return <DashboardPanel title="Bill status" description={`${number.format(finance.bills.total)} bills`}><div className="h-48 p-4"><ChartContainer config={billConfig}><BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 2, right: 12 }}><CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="status" tickLine={false} axisLine={false} width={54} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} maxBarSize={22} /></BarChart></ChartContainer></div></DashboardPanel>;
}

function Readiness({ data }: { data: StaffDashboard }) {
  const isAdmin = data.role === "admin";
  const cells = isAdmin && data.enrollment ? [
    { label: "Admissions", value: data.openTerm?.admissionOpen ? "Open" : "Closed", good: Boolean(data.openTerm?.admissionOpen) },
    { label: "Progression", value: data.enrollment.progression.open ? "Open" : "Closed", good: data.enrollment.progression.open },
    { label: "Sectioning", value: data.enrollment.sections.unsectioned ? `${data.enrollment.sections.unsectioned} pending` : "Ready", good: !data.enrollment.sections.unsectioned },
    { label: "Billing setup", value: data.finance.bills.total ? "Ready" : "Not started", good: Boolean(data.finance.bills.total) },
  ] : [
    { label: "Payment proofs", value: data.finance.pendingPayments ? `${data.finance.pendingPayments} pending` : "Clear", good: !data.finance.pendingPayments },
    { label: "Collections", value: `${data.finance.collectionRate}% posted`, good: data.finance.collectionRate >= 80 },
    { label: "Enrollments", value: data.operations.pendingEnrollments ? `${data.operations.pendingEnrollments} pending` : "Clear", good: !data.operations.pendingEnrollments },
    { label: "Billing records", value: `${data.finance.bills.total} active`, good: Boolean(data.finance.bills.total) },
  ];

  return <DashboardPanel title={isAdmin ? "Academic year readiness" : "Finance readiness"} description="Live status"><div className="grid grid-cols-2">{cells.map((cell) => <div key={cell.label} className="border-r border-b p-4 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"><span className="text-muted-foreground block text-xs">{cell.label}</span><strong className={cn("mt-1.5 block text-sm", cell.good ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>{cell.value}</strong></div>)}</div></DashboardPanel>;
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">{items.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><span className={cn("h-1 w-3", item.color)} />{item.label}</span>)}</div>;
}

function buildQueue(data: StaffDashboard, navigate: (path: string) => void): DashboardQueueItem[] {
  const items: DashboardQueueItem[] = [];
  const add = (value: number, label: string, detail: string, actionLabel: string, path: string, tone: DashboardQueueItem["tone"] = "warning") => {
    if (value > 0) items.push({ value, label, detail, actionLabel, onAction: () => navigate(path), tone });
  };
  add(data.finance.pendingPayments, "Payment verification", "Submitted proofs are ready for review", "Verify", "/admin/billing");
  if (data.role === "admin" && data.enrollment) {
    add(data.enrollment.applications.pending, "Application review", "Admissions records need a decision", "Review", "/admin/applications");
    add(data.enrollment.sections.unsectioned, "Section assignment", "Enrolled students need placement", "Assign", "/admin/sections");
  }
  add(data.operations.pendingEnrollments, "Pending enrollments", "Waiting for billing movement", "Open", "/admin/enrollments");
  add(data.finance.bills.unpaid + data.finance.bills.partial, "Receivable follow-up", "Unpaid and partially paid accounts", "Follow up", "/admin/billing");
  if (data.role === "admin" && data.enrollment?.progression.open) add(data.enrollment.progression.pendingDecisions, "Progression decisions", "End-of-year decisions remain", "Decide", "/admin/progression");
  return items;
}
