import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2Icon,
  ClockIcon,
  CircleAlertIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { useAuthStore } from "@/features/auth/store";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useMyBill } from "@/features/bills/hooks";
import {
  BILL_STATUS_META,
  INSTALLMENT_STATUS_META,
} from "@/features/bills/types";
import { useMyStudent } from "../hooks";
import { StudentStatusBadge } from "./student-status-badge";

type Tone = "danger" | "warning" | "success" | "info";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "PP");
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data: student, isLoading, isError } = useMyStudent();
  const { data: bill } = useMyBill();
  const programLabel = useProgramLabel();

  if (isLoading) {
    return (
      <div className="space-y-6 mx-auto max-w-7xl">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-2 mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          Your student profile isn't available yet. Please check back shortly.
        </p>
      </div>
    );
  }

  const billStatus = bill ? BILL_STATUS_META[bill.status] : null;
  const installments = bill?.installments ?? [];

  // Pending payments the cashier hasn't verified yet.
  const pending = (bill?.payments ?? []).filter((p) => p.status === "pending");
  const pendingTotal = pending.reduce((sum, p) => sum + p.amount, 0);

  // The next unpaid installment, if the bill is on a plan.
  const nextDue = installments
    .filter((i) => i.balance > 0)
    .sort((a, b) => a.sequence - b.sequence)[0];
  const dueDate = nextDue?.dueDate ?? null;
  const overdue =
    !!dueDate && new Date(`${dueDate}T00:00:00`).getTime() < Date.now();

  const percentPaid =
    bill && bill.netTotal > 0
      ? Math.min(100, Math.round((bill.amountPaid / bill.netTotal) * 100))
      : bill
        ? 100
        : 0;

  // The single most important thing this screen says — drives the spotlight.
  let lead: {
    tone: Tone;
    icon: LucideIcon;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  };

  if (!bill) {
    lead = {
      tone: "info",
      icon: ReceiptTextIcon,
      title: "No bill issued yet",
      description: `Your tuition assessment${
        student.schoolYear ? ` for SY ${student.schoolYear}` : ""
      } will appear here once your enrollment is processed.`,
    };
  } else if (bill.balance <= 0) {
    lead = {
      tone: "success",
      icon: CheckCircle2Icon,
      title: "You're all set",
      description: `Your tuition for SY ${bill.schoolYear} is fully settled. Nothing is due.`,
      action: { label: "View bill", onClick: () => navigate("/portal/bills") },
    };
  } else if (bill.amountDue > 0) {
    const when = formatDate(dueDate);
    lead = {
      tone: overdue ? "danger" : "warning",
      icon: overdue ? TriangleAlertIcon : ClockIcon,
      title: overdue ? "Payment overdue" : "Payment due",
      description: `${formatPeso(bill.amountDue)}${
        when ? ` due ${when}` : ""
      }. Settle this to keep your enrollment in good standing.`,
      action: {
        label: `Pay ${formatPeso(bill.amountDue)}`,
        onClick: () => navigate("/portal/bills"),
      },
    };
  } else {
    lead = {
      tone: "info",
      icon: CheckCircle2Icon,
      title: "You're up to date",
      description: nextDue
        ? `Nothing due right now. Next payment of ${formatPeso(
            nextDue.balance,
          )}${formatDate(dueDate) ? ` on ${formatDate(dueDate)}` : ""}.`
        : "Nothing due right now.",
      action: { label: "View bill", onClick: () => navigate("/portal/bills") },
    };
  }

  return (
    <div className="space-y-6 mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {student.firstName}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {programLabel(student.trackOrStrand)}
            {student.schoolYear ? ` · SY ${student.schoolYear}` : ""} · Student
            no. {student.studentNumber}
          </p>
        </div>
        <StudentStatusBadge status={student.status} />
      </div>

      {/* Payment under review — the one attention item with no home in the sidebar */}
      {pending.length > 0 ? (
        <Alert className="border-primary/15 bg-primary/5">
          <ClockIcon className="size-4" />
          <AlertTitle>
            {pending.length === 1
              ? "A payment is under review"
              : `${pending.length} payments are under review`}
          </AlertTitle>
          <AlertDescription>
            {formatPeso(pendingTotal)} submitted — the cashier is verifying your
            proof of payment. Your balance updates once it's confirmed.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Outstanding Balance"
          value={bill ? formatPeso(bill.balance) : "—"}
          hint={bill ? `Net ${formatPeso(bill.netTotal)}` : "No bill issued"}
          accent={bill && bill.balance > 0 ? "primary" : "success"}
        />
        <SummaryTile
          label="Amount Due Now"
          value={bill ? formatPeso(bill.amountDue) : "—"}
          hint={
            dueDate
              ? `Due ${formatDate(dueDate)}`
              : bill
                ? "Nothing due"
                : "—"
          }
          accent={bill && bill.amountDue > 0 ? "warning" : "default"}
        />
        <SummaryTile
          label="Total Paid"
          value={bill ? formatPeso(bill.amountPaid) : "—"}
          hint={bill ? `${percentPaid}% of net assessed` : "—"}
          accent="success"
        />
        <SummaryTile
          label="Year Level"
          value={labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel ?? "") || "—"}
          hint={student.schoolYear ? `SY ${student.schoolYear}` : "—"}
          accent="default"
        />
      </div>

      {/* Body */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        {/* Account summary */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">Account summary</CardTitle>
            <CardDescription>
              {bill
                ? `SY ${bill.schoolYear}${bill.semester ? ` · ${bill.semester}` : ""}`
                : "Your tuition assessment for the open term."}
            </CardDescription>
            {billStatus ? (
              <CardAction>
                <Badge variant="outline" className={billStatus.className}>
                  {billStatus.label}
                </Badge>
              </CardAction>
            ) : null}
          </CardHeader>

          {bill ? (
            <CardContent className="space-y-5">
              <dl className="space-y-2">
                <StatementRow
                  label="Net assessed"
                  value={formatPeso(bill.netTotal)}
                />
                <StatementRow
                  label="Payments received"
                  value={formatPeso(bill.amountPaid)}
                />
                <div className="border-t pt-2">
                  <StatementRow
                    label="Outstanding balance"
                    value={formatPeso(bill.balance)}
                    emphasis
                  />
                </div>
              </dl>

              {installments.length > 0 ? (
                <div className="space-y-1 border-t pt-4">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    Payment schedule
                  </p>
                  <ul className="divide-y">
                    {installments.map((inst) => {
                      const meta = INSTALLMENT_STATUS_META[inst.status];
                      return (
                        <li
                          key={inst.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {inst.label}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {inst.dueDate
                                ? `Due ${formatDate(inst.dueDate)}`
                                : "No due date"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium tabular-nums">
                              {formatPeso(inst.amount)}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("shrink-0", meta.className)}
                            >
                              {meta.label}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-muted-foreground text-sm">
                No bill has been issued yet. Your assessment and payment schedule
                will appear here once your enrollment is processed.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Side column */}
        <div className="space-y-6">
          {/* Priority spotlight */}
          <Card className="border-primary/10 bg-gradient-to-br from-primary/8 via-background to-background">
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                Priority
              </CardDescription>
              <CardTitle className="text-lg">{lead.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm leading-6">
                {lead.description}
              </p>
              {billStatus ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={billStatus.className}>
                    {billStatus.label}
                  </Badge>
                  {dueDate ? (
                    <Badge variant="outline">Due {formatDate(dueDate)}</Badge>
                  ) : null}
                </div>
              ) : null}
              {lead.action ? (
                <Button className="w-full" onClick={lead.action.onClick}>
                  <CircleAlertIcon />
                  {lead.action.label}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {/* Enrollment record */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enrollment</CardTitle>
              <CardDescription>Your record for the term.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RecordRow
                label="Program"
                value={programLabel(student.trackOrStrand)}
              />
              <RecordRow
                label="Year level"
                value={labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel ?? "")}
              />
              <RecordRow
                label="School year"
                value={student.schoolYear ?? "—"}
              />
              <RecordRow
                label="Status"
                value={<StudentStatusBadge status={student.status} />}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "default" | "primary" | "warning" | "success";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
            accent === "primary" && "text-primary",
            accent === "warning" && "text-amber-700 dark:text-amber-300",
            accent === "success" && "text-emerald-700 dark:text-emerald-300",
          )}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

function StatementRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        emphasis ? "text-base" : "text-sm",
      )}
    >
      <span className={emphasis ? "font-semibold" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RecordRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      {typeof value === "string" ? (
        <span className="truncate text-sm font-medium">{value || "—"}</span>
      ) : (
        value
      )}
    </div>
  );
}
