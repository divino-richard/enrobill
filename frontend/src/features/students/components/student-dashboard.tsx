import { useEffect, useState } from 'react';
import { useStudentReturn } from '@/features/re-enrollment/api';
import { PostDropDashboard } from '@/features/re-enrollment/post-drop-dashboard';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarDaysIcon, FileWarningIcon, GraduationCapIcon } from 'lucide-react';
import { DashboardError, DashboardLoading } from '@/components/dashboard/dashboard-primitives';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyBill } from '@/features/bills/hooks';
import { nextOutstandingInstallment } from '@/features/bills/utils';
import { useProgramLabel } from '@/features/programs/hooks';
import { StudentReferralCard } from '@/features/referrals/components/student-referral-card';
import { useMyClassSchedule } from '@/features/scheduling/hooks';
import { useMyDocuments } from '@/features/student-documents/hooks';
import { useMyStudent } from '../hooks';
import { STUDENT_STATUS_OPTIONS } from '../types';
import { YEAR_LEVEL_OPTIONS, labelFor } from '@/features/applications/types';
import { schoolMoment } from '../dashboard-schedule';
import { DashboardClasses, ScheduleLink } from './dashboard-classes';
import { DashboardBilling } from './dashboard-billing';

function isNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function PanelLoading({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="space-y-4 py-5">
    <Skeleton className="h-8 w-40 max-w-full" />
    <Skeleton className="h-5 w-2/3" />
    <Skeleton className="h-16 w-full" />
  </div>;
}

function PanelError({ label, retry, busy }: { label: string; retry: () => void; busy: boolean }) {
  return <div className="space-y-3 py-5">
    <p role="alert" className="text-sm text-muted-foreground">{label}</p>
    <Button variant="outline" className="min-h-11" disabled={busy} onClick={retry}>{busy ? 'Retrying…' : 'Try again'}</Button>
  </div>;
}

function useSchoolClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return now;
}

export function StudentDashboard() {
  const studentQuery = useMyStudent();
  const returnQuery = useStudentReturn();
  const billQuery = useMyBill();
  const scheduleQuery = useMyClassSchedule();
  const documentsQuery = useMyDocuments();
  const programLabel = useProgramLabel();
  const now = useSchoolClock();

  if (studentQuery.isLoading) return <DashboardLoading />;
  if (studentQuery.isError && isNotFound(studentQuery.error)) {
    return <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <section className="rounded-xl border bg-card px-6 py-12 text-center">
        <GraduationCapIcon aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-4 text-base font-semibold">Your student profile is being prepared</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">Your bill and class schedule will appear once enrollment staff link your record.</p>
      </section>
    </div>;
  }
  if (studentQuery.isError || !studentQuery.data) return <DashboardError retry={() => studentQuery.refetch()} />;

  const student = studentQuery.data;
  if (student.status === 'dropped' || (returnQuery.data?.source && returnQuery.data.state !== 'enrolled')) {
    return <PostDropDashboard student={student} />;
  }
  const moment = schoolMoment(now);
  const bill = billQuery.data;
  const schedule = scheduleQuery.data;
  const nextDue = nextOutstandingInstallment(bill?.installments ?? []);
  const paymentNeedsAttention = bill && !billQuery.isError && bill.balance > 0 &&
    (nextDue?.status === 'overdue' || Boolean(nextDue?.dueDate && nextDue.dueDate.slice(0, 10) <= moment.date));
  const returnedDocuments = documentsQuery.isError ? [] : (documentsQuery.data ?? []).filter(item => item.reviewStatus === 'returned');
  const grade = student.yearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel) : 'Not assigned';
  const studentStatus = STUDENT_STATUS_OPTIONS.find(option => option.value === student.status)?.label ?? student.status;
  const billing = bill && !billQuery.isError ? <DashboardBilling bill={bill} today={moment.date} /> :
    <section aria-labelledby="student-bill-title" className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 id="student-bill-title" className="text-base font-semibold">Fees &amp; payments</h2>
      {billQuery.isLoading ? <PanelLoading label="Loading your bill" /> : billQuery.isError && !isNotFound(billQuery.error) ?
        <PanelError label="Your bill couldn’t be loaded." retry={() => billQuery.refetch()} busy={billQuery.isFetching} /> :
        <div className="space-y-2 py-5 text-sm"><p className="font-medium">No bill yet</p><p className="text-muted-foreground">Your fees and payment schedule will appear after enrollment processing.</p></div>}
      <Button asChild variant="link" className="min-h-11 px-0"><Link to="/portal/bills">View all bills<ArrowRightIcon aria-hidden="true" /></Link></Button>
    </section>;

  return <div className="mx-auto min-w-0 max-w-6xl space-y-5 selection:bg-primary/15">
    <header className="flex flex-wrap items-center justify-between gap-3 py-1">
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight wrap-anywhere">Welcome back, {student.firstName}.</h1>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDaysIcon aria-hidden="true" className="size-4 shrink-0" /><time dateTime={moment.date}>{moment.label}</time></p>
    </header>

    {returnedDocuments.length > 0 && <section aria-label="Documents need attention" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex min-w-0 items-start gap-3">
        <FileWarningIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1 text-sm"><h2 className="font-semibold">{returnedDocuments.length} {returnedDocuments.length === 1 ? 'document needs' : 'documents need'} updating</h2><p>Check the reviewer’s notes before uploading a replacement.</p></div>
      </div>
      <Button asChild variant="ghost" className="min-h-11 text-current hover:bg-amber-100 dark:hover:bg-amber-900"><Link to="/portal/programs?section=clearance-grades">Review documents<ArrowRightIcon aria-hidden="true" /></Link></Button>
    </section>}
    {documentsQuery.isError && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <p role="alert" className="text-muted-foreground">Document updates couldn’t be loaded.</p>
      <Button variant="link" className="min-h-11 px-0" disabled={documentsQuery.isFetching} onClick={() => documentsQuery.refetch()}>Try again</Button>
    </div>}

    {paymentNeedsAttention && billing}

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,1fr)]">
      <section aria-labelledby="student-schedule-title" className="min-w-0 rounded-xl border bg-card p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 id="student-schedule-title" className="text-base font-semibold">Today’s classes</h2>
          <ScheduleLink />
        </header>
        {scheduleQuery.isLoading ? <PanelLoading label="Loading your schedule" /> : scheduleQuery.isError ?
          <PanelError label="Your schedule couldn’t be loaded." retry={() => scheduleQuery.refetch()} busy={scheduleQuery.isFetching} /> :
          <DashboardClasses schedule={schedule} now={now} />}
      </section>
      <section aria-labelledby="student-enrollment-title" className="min-w-0 rounded-xl border bg-card p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="student-enrollment-title" className="text-base font-semibold">Your enrollment</h2>
          <span className="text-sm text-muted-foreground">{studentStatus}</span>
        </header>
        <p className="mt-4 text-sm font-medium leading-relaxed wrap-anywhere">{programLabel(student.trackOrStrand)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="min-w-0"><dt className="text-muted-foreground">Year level</dt><dd className="mt-1 font-medium wrap-anywhere">{grade}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">Section</dt><dd className="mt-1 font-medium wrap-anywhere">{scheduleQuery.isLoading ? 'Loading…' : scheduleQuery.isError ? 'Unavailable' : schedule?.section?.name ?? 'Not assigned'}</dd></div>
          <div className="col-span-2 flex flex-wrap justify-between gap-x-3 gap-y-1 border-t pt-3"><dt className="text-muted-foreground">Student number</dt><dd className="font-medium tabular-nums wrap-anywhere">{student.studentNumber}</dd></div>
        </dl>
      </section>
    </div>

    {!paymentNeedsAttention && billing}
    <StudentReferralCard compact showWhenUnavailable={student.yearLevel === 'grade_11' || student.yearLevel === 'grade_12'} />
  </div>;
}
