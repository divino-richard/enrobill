import { ProgramReturnPanel } from '@/features/re-enrollment/program-return-panel';
import { useStudentReturn } from '@/features/re-enrollment/api';
import { DocumentHistory } from '@/features/student-documents/components/document-history';
import { StudentDroppingTab } from '@/features/dropping/dropping-page';
import { useMutation } from '@tanstack/react-query';
import { downloadDroppingFile } from '@/features/dropping/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { NEW_STUDENT_DROPPING_PATH } from '@/features/dropping/paths';
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { format } from "date-fns";
import {
  ArrowRightLeftIcon,
  CalendarClockIcon,
  FolderUpIcon,
  GraduationCapIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  FileMinusIcon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentClassSchedule } from "@/features/scheduling/student-schedule";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useMyEnrollments, useMyStudent } from "@/features/students/hooks";
import { useMyDocuments } from "@/features/student-documents/hooks";
import {
  ClearanceGradesPanel,
  TOTAL_DOCUMENT_SLOTS,
} from "@/features/student-documents/components/clearance-grades-panel";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { EnrollmentStatusBadge } from "@/features/students/components/enrollment-status-badge";
import type { EnrollmentRecord } from "@/features/students/types";
import { TransferRequestPanel } from "@/features/program-transfers/components/transfer-request-panel";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function termLabel(record: EnrollmentRecord): string {
  return record.schoolYear ? `SY ${record.schoolYear}` : "—";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "PP");
}

function EmptyTab({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof HistoryIcon;
  title: string;
  message: string;
}) {
  return <EmptyState icon={Icon} title={title} description={message} />;
}

function ProgramsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('section') ?? 'overview';
  const activeTab = ['overview', 'schedule', 'clearance-grades', 'history', 'dropping', 'transfer'].includes(section) ? section : 'overview';
  const setActiveTab = (value: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    next.set('section', value);
    if (value !== 'dropping') next.delete('request');
    return next;
  }, {replace: true});
  const { data: student, isLoading, isError } = useMyStudent();
  const { data: enrollments } = useMyEnrollments();
  const programLabel = useProgramLabel();
  const returning = useStudentReturn();
  const formDownload = useMutation({
    mutationFn: () => downloadDroppingFile('/dropping-requests/form', 'official-dropping-form.pdf'),
  });
  // Drives the tab's "n/4" badge, so an unfinished submission is visible without
  // opening the tab. Read before any early return — hook order must stay stable.
  const { data: myDocuments } = useMyDocuments();
  const uploadedDocuments = myDocuments?.length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4 mx-auto max-w-7xl">
        <Skeleton className="h-9 w-44 rounded-md" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">My Program</h1>
        <EmptyTab
          icon={GraduationCapIcon}
          title="Not enrolled yet"
          message="Once your enrollment is processed, your program will appear here."
        />
      </div>
    );
  }

  const records = enrollments ?? [];
  // The enrollment for the open term, if any — otherwise fall back to the
  // student's own record for the headline.
  const postDrop = student.status === 'dropped' || (!!returning.data?.source && returning.data.state !== 'enrolled');
  const current = postDrop ? records[0] ?? null : records.find((r) => r.isCurrent) ?? records[0] ?? null;
  const history = records.filter((r) => r !== current);

  const currentProgram = current?.program ?? student.trackOrStrand;
  const currentYearLevel = current?.yearLevel ?? student.yearLevel;
  const currentSchoolYear = current?.schoolYear ?? student.schoolYear;
  const selectedTab = postDrop && activeTab === 'transfer' ? 'overview' : activeTab;

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-5">
      <PageHeader title="My Program" />

      <Tabs value={selectedTab} onValueChange={setActiveTab}>
        <TabsList aria-label="Program information" variant="line">
          <TabsTrigger value="overview">
            <GraduationCapIcon />
            Overview
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarClockIcon />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="clearance-grades">
            <FolderUpIcon />
            {postDrop ? "Saved documents" : "Clearance & Grades"}
            {!postDrop && <Badge
              variant="secondary"
              className="ml-0.5 h-5 justify-center px-1 font-normal tabular-nums"
            >
              {uploadedDocuments}/{TOTAL_DOCUMENT_SLOTS}
            </Badge>}
          </TabsTrigger>
          <TabsTrigger value="dropping">
            <FileMinusIcon />
            Dropping requests
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon />
            History
            {history.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-5 min-w-5 justify-center px-1 font-normal tabular-nums"
              >
                {history.length}
              </Badge>
            )}
          </TabsTrigger>
          {!postDrop && <TabsTrigger value="transfer">
            <ArrowRightLeftIcon />
            Transfer
          </TabsTrigger>}
        </TabsList>

        {/* Keep the dialog mounted so re-enrollment links also work from another tab. */}
        <TabsContent value="overview" forceMount hidden={selectedTab !== 'overview'}>
          <Card className="shadow-none [--card-spacing:--spacing(5)]">
            <CardHeader className="gap-2">
              <CardTitle className="text-lg">
                {programLabel(currentProgram)}
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{labelFor(YEAR_LEVEL_OPTIONS, currentYearLevel ?? "")}</span>
                {currentSchoolYear && <><span aria-hidden="true">·</span><span>SY {currentSchoolYear}</span></>}
              </CardDescription>
              <CardAction className="flex items-center gap-2">
                {current ? (
                  <EnrollmentStatusBadge status={current.status} />
                ) : (
                  <StudentStatusBadge status={student.status} />
                )}
                {current?.isCurrent && current.status === "enrolled" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-10" aria-label="Enrollment options" title="Enrollment options">
                        <MoreHorizontalIcon aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuItem className="min-h-11" disabled={formDownload.isPending} onSelect={() => formDownload.mutate()}>
                        {formDownload.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}
                        {formDownload.isPending ? 'Downloading form…' : 'Download dropping form'}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="min-h-11">
                        <Link to={NEW_STUDENT_DROPPING_PATH}><FileMinusIcon aria-hidden="true" />Request to drop</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="border-t pt-5">
              <h2 className="mb-4 text-sm font-semibold">Enrollment details</h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                <Detail label="Student number" value={student.studentNumber} />
                <Detail
                  label="Enrolled on"
                  value={formatDate(current?.enrolledAt ?? null)}
                />
                {current?.status === 'dropped' && returning.data?.source?.id === current.id && (
                  <Detail label="Dropped on" value={formatDate(returning.data.effectiveDroppingDate)} />
                )}
              </dl>
              {formDownload.isPending && <p role="status" className="mt-4 text-sm text-muted-foreground">Downloading dropping form…</p>}
              {formDownload.isError && <p role="alert" className="mt-4 text-sm text-destructive">{getErrorMessage(formDownload.error)}</p>}
            </CardContent>
            <ProgramReturnPanel />
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <StudentClassSchedule />
        </TabsContent>

        <TabsContent value="clearance-grades">
          {postDrop ? <DocumentHistory /> : <ClearanceGradesPanel />}
        </TabsContent>

        <TabsContent value="dropping">
          <StudentDroppingTab />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="shadow-none [--card-spacing:--spacing(5)]">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Enrollment history</CardTitle>
              <CardDescription>
                Your program and level across past terms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyTab
                  icon={HistoryIcon}
                  title="No past enrollments"
                  message="Previous terms will be listed here as you progress."
                />
              ) : (
                <ul className="divide-y">
                  {history.map((record) => (
                    <li
                      key={record.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {programLabel(record.program)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {labelFor(YEAR_LEVEL_OPTIONS, record.yearLevel ?? "")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary" className="font-normal">
                          {termLabel(record)}
                        </Badge>
                        <EnrollmentStatusBadge status={record.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {!postDrop && <DocumentHistory />}
        </TabsContent>

        {!postDrop && <TabsContent value="transfer">
          <TransferRequestPanel
            currentProgramCode={currentProgram ?? ""}
            currentProgramName={programLabel(currentProgram)}
          />
        </TabsContent>}
      </Tabs>
    </div>
  );
}

export default ProgramsPage;
