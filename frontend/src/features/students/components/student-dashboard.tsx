import { useStudentReturn } from '@/features/re-enrollment/api';
import { PostDropDashboard } from '@/features/re-enrollment/post-drop-dashboard';
import { format } from "date-fns";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckIcon,
  Clock3Icon,
  FileWarningIcon,
  GraduationCapIcon,
} from "lucide-react";
import { DashboardError, DashboardLoading } from "@/components/dashboard/dashboard-primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyBill } from "@/features/bills/hooks";
import { nextOutstandingInstallment } from "@/features/bills/utils";
import { useProgramLabel } from "@/features/programs/hooks";
import { StudentReferralCard } from "@/features/referrals/components/student-referral-card";
import { useMyClassSchedule } from "@/features/scheduling/hooks";
import { SCHEDULE_DAYS, scheduleTime } from "@/features/scheduling/types";
import { useMyDocuments } from "@/features/student-documents/hooks";
import { useMyStudent } from "../hooks";
import { STUDENT_STATUS_OPTIONS } from "../types";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { formatPeso } from "@/lib/money";

function dateLabel(value: string | null | undefined) {
  if (!value) return "No due date set";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "No due date set" : format(date, "MMM d, yyyy");
}

function isNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function PanelLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4 py-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function PanelError({ label, retry, busy }: { label: string; retry: () => void; busy: boolean }) {
  return (
    <div className="space-y-3 py-5">
      <p role="alert" className="text-muted-foreground">{label}</p>
      <Button variant="outline" disabled={busy} onClick={retry}>{busy ? "Retrying…" : "Try again"}</Button>
    </div>
  );
}

export function StudentDashboard() {
  const studentQuery = useMyStudent();
  const returnQuery = useStudentReturn();
  const billQuery = useMyBill();
  const scheduleQuery = useMyClassSchedule();
  const documentsQuery = useMyDocuments();
  const programLabel = useProgramLabel();

  if (studentQuery.isLoading) return <DashboardLoading />;
  if (studentQuery.isError && isNotFound(studentQuery.error)) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <section className="bg-card rounded-2xl border px-6 py-12 text-center">
          <GraduationCapIcon aria-hidden="true" className="text-muted-foreground mx-auto size-8" />
          <h2 className="mt-4 text-base font-semibold">Your student profile is being prepared</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md">Your bill and class schedule will appear once enrollment staff link your record.</p>
        </section>
      </div>
    );
  }
  if (studentQuery.isError || !studentQuery.data) {
    return <DashboardError retry={() => studentQuery.refetch()} />;
  }

  const student = studentQuery.data;
  if (student.status === "dropped" || (returnQuery.data?.source && returnQuery.data.state !== "enrolled")) {
    return <PostDropDashboard student={student} />;
  }
  const bill = billQuery.data;
  const schedule = scheduleQuery.data;
  const nextDue = nextOutstandingInstallment(bill?.installments ?? []);
  const returnedDocuments = (documentsQuery.data ?? []).filter((item) => item.reviewStatus === "returned");
  const pendingPayments = (bill?.payments ?? []).filter((item) => item.status === "pending");
  const now = new Date();
  const schoolDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "long" }).format(now);
  const today = SCHEDULE_DAYS.indexOf(schoolDay) + 1;
  const todayLabel = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" }).format(now);
  const todayClasses = (schedule?.entries ?? []).filter((entry) => entry.day === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextClass = (schedule?.entries ?? [])
    .filter((entry) => entry.day !== today)
    .sort((a, b) => ((a.day - today + 7) % 7) - ((b.day - today + 7) % 7) || a.startTime.localeCompare(b.startTime))[0];
  const billUrl = bill ? `/portal/bills/${bill.id}` : "/portal/bills";
  const grade = student.yearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel) : "Not assigned";
  const covered = bill ? (bill.netTotal > 0 ? Math.min(100, Math.max(0, (bill.netTotal - bill.balance) / bill.netTotal * 100)) : 100) : 0;
  const coverageLabel = `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(covered)}% covered`;
  const studentStatus = STUDENT_STATUS_OPTIONS.find((option) => option.value === student.status)?.label ?? student.status;

  return (
    <div className="mx-auto max-w-6xl space-y-6 selection:bg-primary/15">
      <header className="flex flex-wrap items-center justify-between gap-4 py-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {student.firstName}.</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Here’s your student overview.</p>
        </div>
        <div className="text-muted-foreground flex items-center gap-2.5 text-sm">
          <CalendarDaysIcon aria-hidden="true" className="size-4" />
          <span>{schoolDay}, {todayLabel}</span>
        </div>
      </header>

      {returnedDocuments.length > 0 && (
        <section aria-label="Documents need attention" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <div className="flex min-w-0 items-start gap-3">
            <FileWarningIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="text-sm font-medium">{returnedDocuments.length} {returnedDocuments.length === 1 ? "document needs" : "documents need"} updating</h2>
              <p className="mt-0.5 text-xs">Check the reviewer’s notes before uploading a replacement.</p>
            </div>
          </div>
          <Button asChild variant="ghost" className="h-10 text-current hover:bg-amber-100 dark:hover:bg-amber-900"><Link to="/portal/programs">Review documents<ArrowRightIcon aria-hidden="true" /></Link></Button>
        </section>
      )}
      {documentsQuery.isError && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <p role="alert" className="text-muted-foreground">Document updates couldn’t be loaded.</p>
          <Button variant="link" className="h-10 px-0" disabled={documentsQuery.isFetching} onClick={() => documentsQuery.refetch()}>Try again</Button>
        </div>
      )}

      <section aria-labelledby="student-bill-title" className="bg-card overflow-hidden rounded-2xl border">
        <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,1fr)]">
          <div className="min-w-0 p-5 sm:p-7">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="student-bill-title" className="text-base font-semibold">Tuition overview</h2>
              {bill?.schoolYear && <span className="text-muted-foreground text-xs">SY {bill.schoolYear}</span>}
            </header>
            {billQuery.isLoading ? <PanelLoading label="Loading your bill" /> : billQuery.isError && !isNotFound(billQuery.error) ? (
              <PanelError label="Your bill couldn’t be loaded." retry={() => billQuery.refetch()} busy={billQuery.isFetching} />
            ) : bill ? (
              <>
                <dl className="mt-6 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
                  <div>
                    <dt className="text-muted-foreground text-xs">Remaining balance</dt>
                    <dd className="mt-1 text-2xl font-medium tracking-tight tabular-nums sm:text-3xl">{formatPeso(bill.balance)}</dd>
                  </div>
                  <div className="border-l pl-5">
                    <dt className="text-muted-foreground text-xs">Paid to date</dt>
                    <dd className="mt-2 text-lg font-medium tracking-tight tabular-nums sm:text-xl">{formatPeso(bill.amountPaid)}</dd>
                  </div>
                </dl>
                <div className="mt-6">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{coverageLabel}</span>
                    <span className="text-muted-foreground">{bill.droppingAssessment ? "Final charge" : "Total fees"} <strong className="text-foreground ml-1 font-medium tabular-nums">{formatPeso(bill.netTotal)}</strong></span>
                  </div>
                  <div role="progressbar" aria-label="Fees covered by verified payments and credit" aria-valuenow={Number(covered.toFixed(1))} aria-valuemin={0} aria-valuemax={100} className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${covered}%` }} />
                  </div>
                </div>
                {((bill.creditApplied ?? 0) > 0 || (bill.availableCredit ?? 0) > 0) && (
                  <dl className="text-muted-foreground mt-4 space-y-1.5 text-xs">
                    {(bill.creditApplied ?? 0) > 0 && <div className="flex justify-between gap-3"><dt>Credit applied</dt><dd className="text-foreground tabular-nums">{formatPeso(bill.creditApplied ?? 0)}</dd></div>}
                    {(bill.availableCredit ?? 0) > 0 && <div className="flex justify-between gap-3"><dt>Credit for a future enrollment</dt><dd className="text-foreground tabular-nums">{formatPeso(bill.availableCredit ?? 0)}</dd></div>}
                  </dl>
                )}
              </>
            ) : (
              <div className="space-y-2 py-8">
                <p className="font-medium">No bill yet</p>
                <p className="text-muted-foreground max-w-sm text-sm">Your fees and payment schedule will appear after enrollment processing.</p>
              </div>
            )}
          </div>
          {bill && !billQuery.isError ? (
            <div className="bg-primary text-primary-foreground flex flex-col justify-between gap-5 p-5 sm:p-7 dark:bg-secondary">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{bill.balance > 0 ? "Next payment" : "Payment complete"}</h3>
                  {bill.balance > 0 && nextDue?.status === "overdue" && <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs">Overdue</span>}
                  {bill.balance <= 0 && <CheckIcon aria-hidden="true" className="size-5" />}
                </div>
                <p className="mt-3 text-3xl font-medium tracking-tight tabular-nums">{formatPeso(bill.amountDue)}</p>
                <p className="mt-2 text-xs leading-relaxed text-primary-foreground/85">{bill.balance <= 0 ? "This bill is fully covered." : nextDue?.dueDate ? `Due ${dateLabel(nextDue.dueDate)}` : "See your bill for payment details."}</p>
              </div>
              <Button asChild className="h-11 w-full justify-between bg-primary-foreground px-4 text-primary hover:bg-primary-foreground/90 focus-visible:ring-primary-foreground dark:text-secondary"><Link to={billUrl}>{bill.balance > 0 ? "View bill & pay" : "View statement"}<ArrowRightIcon aria-hidden="true" /></Link></Button>
            </div>
          ) : (
            <div className="bg-muted/30 flex flex-col justify-center gap-2 border-t p-5 sm:p-7 lg:border-t-0 lg:border-l">
              <h3 className="text-sm font-medium">Your billing records</h3>
              <p className="text-muted-foreground text-sm">View bills and payments from each school year.</p>
              <Button asChild variant="link" className="h-11 justify-start px-0"><Link to="/portal/bills">View all bills<ArrowRightIcon aria-hidden="true" /></Link></Button>
            </div>
          )}
        </div>
        {bill && !billQuery.isError && (pendingPayments.length > 0 || (bill.previousBalance ?? 0) > 0) && (
          <div className="space-y-2 border-t px-5 py-3 text-xs sm:px-7">
            {pendingPayments.length > 0 && <p className="text-muted-foreground flex items-center gap-2"><Clock3Icon aria-hidden="true" className="size-3.5 shrink-0" /><span>{pendingPayments.length === 1 ? "Payment awaiting verification" : `${pendingPayments.length} payments awaiting verification`}. Your balance updates after review.</span></p>}
            {(bill.previousBalance ?? 0) > 0 && <p className="text-muted-foreground">Previous school-year balance: <Link className="text-foreground font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" to="/portal/bills">{formatPeso(bill.previousBalance ?? 0)}</Link></p>}
          </div>
        )}
      </section>

      <div className="bg-card grid overflow-hidden rounded-2xl border lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,1fr)]">
        <section aria-labelledby="student-schedule-title" className="min-w-0 p-5 sm:p-7">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="student-schedule-title" className="text-base font-semibold">Today’s classes</h2>
            <Button asChild variant="link" className="-my-2 h-10 px-0 text-xs"><Link to="/portal/programs">View schedule<ArrowRightIcon aria-hidden="true" className="size-3.5" /></Link></Button>
          </header>
          {scheduleQuery.isLoading ? <PanelLoading label="Loading your schedule" /> : scheduleQuery.isError ? (
            <PanelError label="Your schedule couldn’t be loaded." retry={() => scheduleQuery.refetch()} busy={scheduleQuery.isFetching} />
          ) : schedule?.status === "published" && todayClasses.length ? (
            <ol className="mt-4 divide-y">
              {todayClasses.map((entry) => (
                <li key={entry.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-4">
                  <div className="text-xs tabular-nums"><p className="font-medium">{scheduleTime(entry.startTime)}</p><p className="text-muted-foreground mt-1">{scheduleTime(entry.endTime)}</p></div>
                  <div className="min-w-0 border-l pl-4"><p className="break-words text-sm font-medium">{entry.subject}</p>{(entry.room || entry.teacher) && <p className="text-muted-foreground mt-1 break-words text-xs">{[entry.room, entry.teacher].filter(Boolean).join(" · ")}</p>}</div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex flex-col items-center py-7 text-center">
              <BookOpenIcon aria-hidden="true" strokeWidth={1.5} className="text-muted-foreground size-7" />
              <p className="mt-3 text-sm font-medium">{schedule?.status === "published" ? "No classes today" : "Your schedule is on its way"}</p>
              <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">{schedule?.status === "published" ? "Your full schedule is always one click away." : "Classes will appear once your section’s schedule is published."}</p>
              {schedule?.status === "published" && nextClass && <p className="text-muted-foreground mt-4 text-xs">Next class: <span className="text-foreground font-medium">{SCHEDULE_DAYS[nextClass.day - 1]} · {scheduleTime(nextClass.startTime)}</span></p>}
            </div>
          )}
        </section>

        <section aria-labelledby="student-enrollment-title" className="min-w-0 border-t p-5 sm:p-7 lg:border-t-0 lg:border-l">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="student-enrollment-title" className="text-base font-semibold">Your enrollment</h2>
            <span className="text-muted-foreground text-xs">{studentStatus}</span>
          </header>
          <p className="mt-5 text-sm font-medium leading-relaxed">{programLabel(student.trackOrStrand)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div><dt className="text-muted-foreground">Year level</dt><dd className="mt-1 font-medium">{grade}</dd></div>
            <div><dt className="text-muted-foreground">Section</dt><dd className="mt-1 font-medium">{scheduleQuery.isLoading ? "Loading…" : scheduleQuery.isError ? "Unavailable" : schedule?.section?.name ?? "Not assigned"}</dd></div>
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3"><dt className="text-muted-foreground">Student number</dt><dd className="font-medium tabular-nums">{student.studentNumber}</dd></div>
          </dl>
        </section>
      </div>

      <StudentReferralCard compact showWhenUnavailable={student.yearLevel === "grade_11" || student.yearLevel === "grade_12"} />
    </div>
  );
}
