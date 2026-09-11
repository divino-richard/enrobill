import { format } from "date-fns";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  GraduationCapIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  DashboardError,
  DashboardAttention,
  DashboardHeader,
  DashboardLoading,
  DashboardMetricStrip,
  DashboardPanel,
  DashboardQueue,
  type DashboardMetric,
  type DashboardAttentionItem,
  type DashboardQueueItem,
} from "@/components/dashboard/dashboard-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMyBill } from "@/features/bills/hooks";
import { nextOutstandingInstallment } from "@/features/bills/utils";
import { useProgramLabel } from "@/features/programs/hooks";
import { StudentReferralCard } from "@/features/referrals/components/student-referral-card";
import { useMyClassSchedule } from "@/features/scheduling/hooks";
import { SCHEDULE_DAYS, scheduleTime } from "@/features/scheduling/types";
import { useMyDocuments } from "@/features/student-documents/hooks";
import { useMyStudent } from "../hooks";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { formatPeso } from "@/lib/money";

const paymentConfig = {
  paid: { label: "Paid", color: "var(--color-primary)" },
  remaining: { label: "Remaining", color: "var(--color-muted-foreground)" },
} satisfies ChartConfig;

const classesConfig = {
  classes: { label: "Classes", color: "var(--color-primary)" },
} satisfies ChartConfig;

function dateLabel(value: string | null | undefined) {
  if (!value) return "No due date";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "No due date" : format(date, "MMM d, yyyy");
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const studentQuery = useMyStudent();
  const billQuery = useMyBill();
  const scheduleQuery = useMyClassSchedule();
  const documentsQuery = useMyDocuments();
  const programLabel = useProgramLabel();

  if (studentQuery.isLoading) return <DashboardLoading />;
  const studentProfilePending =
    studentQuery.isError &&
    axios.isAxiosError(studentQuery.error) &&
    studentQuery.error.response?.status === 404;

  if (studentProfilePending) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <DashboardHeader
          description="Your student access is ready. Enrollment details will appear after your profile is linked."
          context={<Badge variant="secondary">Student</Badge>}
        />
        <DashboardPanel title="Profile setup in progress">
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <GraduationCapIcon className="text-primary size-9" />
            <p className="mt-4 font-medium">Your student profile is being prepared</p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              Once enrollment staff link your record, your bill, class schedule, and academic details will appear here.
            </p>
          </div>
        </DashboardPanel>
      </div>
    );
  }

  if (studentQuery.isError || !studentQuery.data) {
    return <DashboardError retry={() => studentQuery.refetch()} />;
  }

  const student = studentQuery.data;
  const bill = billQuery.data;
  const schedule = scheduleQuery.data;
  const documents = documentsQuery.data ?? [];
  const nextDue = nextOutstandingInstallment(bill?.installments ?? []);
  const returnedDocuments = documents.filter((item) => item.reviewStatus === "returned");
  const pendingPayments = (bill?.payments ?? []).filter((item) => item.status === "pending");
  const today = new Date().getDay() || 7;
  const todayClasses = (schedule?.entries ?? [])
    .filter((entry) => entry.day === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const classLoad = SCHEDULE_DAYS.slice(0, 6).map((day, index) => ({
    day: day.slice(0, 3),
    classes: (schedule?.entries ?? []).filter((entry) => entry.day === index + 1).length,
  }));
  const metrics: DashboardMetric[] = [
    {
      label: "Outstanding balance",
      value: bill ? formatPeso(bill.balance) : "—",
      detail: bill ? `${formatPeso(bill.amountPaid)} already paid` : "No bill issued",
      tone: bill?.balance ? "warning" : "success",
    },
    {
      label: "Amount due now",
      value: bill ? formatPeso(bill.amountDue) : "—",
      detail: nextDue ? `Due ${dateLabel(nextDue.dueDate)}` : "Nothing due",
      tone: bill?.amountDue ? "warning" : "success",
    },
    {
      label: "Section",
      value: schedule?.section?.name ?? "—",
      detail: schedule?.schoolYear ? `SY ${schedule.schoolYear}` : "Awaiting assignment",
    },
    {
      label: "Classes today",
      value: todayClasses.length,
      detail: todayClasses[0]
        ? `Next at ${scheduleTime(todayClasses[0].startTime)}`
        : "No class scheduled",
      tone: todayClasses.length ? "primary" : "success",
      trend: classLoad.map((item) => item.classes),
    },
  ];

  const queue: DashboardQueueItem[] = [];
  if (returnedDocuments.length) {
    queue.push({
      value: returnedDocuments.length,
      label: "Returned documents",
      detail: "Replace the files using the reviewer notes.",
      actionLabel: "Replace",
      onAction: () => navigate("/portal/programs"),
      tone: "danger",
    });
  }
  if ((bill?.amountDue ?? 0) > 0) {
    queue.push({
      value: formatPeso(bill?.amountDue ?? 0),
      label: "Payment due",
      detail: nextDue ? `Due ${dateLabel(nextDue.dueDate)}` : "Due now",
      actionLabel: "Pay",
      onAction: () => navigate("/portal/bills"),
      tone: "warning",
    });
  }
  if (pendingPayments.length) {
    queue.push({
      value: pendingPayments.length,
      label: "Payment under review",
      detail: "Your balance updates after cashier verification.",
      actionLabel: "View",
      onAction: () => navigate("/portal/bills"),
    });
  }
  const attentionItems: DashboardAttentionItem[] = [
    ...(returnedDocuments.length ? [{ value: returnedDocuments.length, label: "Returned documents", detail: "Replacement files required", onAction: () => navigate("/portal/programs"), tone: "danger" as const }] : []),
    ...((bill?.amountDue ?? 0) > 0 ? [{ value: formatPeso(bill?.amountDue ?? 0), label: "Payment due", detail: nextDue ? `Due ${dateLabel(nextDue.dueDate)}` : "Due now", onAction: () => navigate("/portal/bills"), tone: "warning" as const }] : []),
    ...(pendingPayments.length ? [{ value: pendingPayments.length, label: "Payment review", detail: "Proof awaiting verification", onAction: () => navigate("/portal/bills"), tone: "primary" as const }] : []),
  ];
  const attentionCount = returnedDocuments.length + pendingPayments.length + ((bill?.amountDue ?? 0) > 0 ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <DashboardHeader
        description={`${programLabel(student.trackOrStrand)} · ${labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel ?? "")} · ${student.studentNumber}`}
        context={<Badge variant="secondary">Student</Badge>}
        actions={
          <Button variant="outline" onClick={() => navigate("/portal/bills")}>
            View my bill
          </Button>
        }
      />

      <DashboardAttention summary={attentionCount ? `${attentionCount} items` : "All clear"} items={attentionItems} />
      <DashboardMetricStrip metrics={metrics} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.42fr)_minmax(18rem,.78fr)]">
        <DashboardPanel title="Payment progress" description={bill ? `SY ${bill.schoolYear}` : "Current academic year"}>
          {bill ? (
            <>
            <div className="text-muted-foreground flex gap-4 px-4 pt-3 text-xs"><span className="inline-flex items-center gap-1.5"><span className="bg-primary h-1 w-3" />Paid</span><span className="inline-flex items-center gap-1.5"><span className="bg-muted-foreground h-1 w-3" />Remaining</span></div>
            <div className="h-40 px-3 pt-2">
              <ChartContainer config={paymentConfig}>
                <BarChart accessibilityLayer data={[{ name: "Tuition", paid: bill.amountPaid, remaining: bill.balance }]} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => formatPeso(Number(value))} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" hide />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatPeso(Number(value))} />} />
                  <Bar dataKey="paid" stackId="bill" fill="var(--color-paid)" radius={[5, 0, 0, 5]} maxBarSize={42} />
                  <Bar dataKey="remaining" stackId="bill" fill="var(--color-remaining)" radius={[0, 5, 5, 0]} maxBarSize={42} />
                </BarChart>
              </ChartContainer>
            </div>
            </>
          ) : (
            <p className="text-muted-foreground px-4 py-14 text-center text-sm">Your tuition assessment will appear after enrollment processing.</p>
          )}
          {bill ? <div className="mx-4 flex flex-wrap justify-between gap-2 border-t py-3 text-xs"><strong>{formatPeso(bill.amountPaid)} paid</strong><span className="text-muted-foreground">{formatPeso(bill.balance)} remaining</span></div> : null}
        </DashboardPanel>
        <DashboardPanel title="Next steps" description="Items that need your attention">
          <DashboardQueue items={queue} />
        </DashboardPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
        <DashboardPanel title="Weekly class load" description={schedule?.section ? `${schedule.section.program.toUpperCase()} · ${schedule.section.name}` : "Published schedule"}>
          {schedule?.status === "published" ? (
            <div className="h-56 p-4">
              <ChartContainer config={classesConfig}>
                <BarChart accessibilityLayer data={classLoad} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="classes" fill="var(--color-classes)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ChartContainer>
            </div>
          ) : (
            <p className="text-muted-foreground px-4 py-14 text-center text-sm">Your schedule will appear after section assignment and publication.</p>
          )}
        </DashboardPanel>
        <DashboardPanel title="Today" description={SCHEDULE_DAYS[today - 1]}>
          {todayClasses.length ? (
            <div className="divide-y">
              {todayClasses.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <BookOpenIcon className="text-primary mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.subject}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{scheduleTime(entry.startTime)}–{scheduleTime(entry.endTime)} · {entry.room}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 py-12 text-center"><CheckCircle2Icon className="text-emerald-600 size-7" /><p className="mt-3 text-sm font-medium">No classes today</p></div>
          )}
        </DashboardPanel>
      </div>

      <StudentReferralCard showWhenUnavailable={student.yearLevel === "grade_11" || student.yearLevel === "grade_12"} />
    </div>
  );
}
