import { PageHeader } from "@/components/page-header";
import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowRightLeftIcon,
  CalendarClockIcon,
  FolderUpIcon,
  GraduationCapIcon,
  HistoryIcon,
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
    <div className="space-y-0.5">
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
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {message}
        </p>
      </div>
    </div>
  );
}

function ProgramsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: student, isLoading, isError } = useMyStudent();
  const { data: enrollments } = useMyEnrollments();
  const programLabel = useProgramLabel();
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
  const current = records.find((r) => r.isCurrent) ?? null;
  const history = records.filter((r) => r !== current);

  const currentProgram = current?.program ?? student.trackOrStrand;
  const currentYearLevel = current?.yearLevel ?? student.yearLevel;
  const currentSchoolYear = current?.schoolYear ?? student.schoolYear;

  return (
    <div className="space-y-4 mx-auto min-w-0 max-w-7xl">
      {/* Header */}
      <div>
        <PageHeader title="My Program" />
      </div>

      {/* Headline — current term */}
      <Card>
        <CardHeader>
          <CardDescription className="text-xs font-medium tracking-wide uppercase">
            {currentSchoolYear ? `SY ${currentSchoolYear}` : "Current term"}
          </CardDescription>
          <CardTitle className="text-lg">
            {programLabel(currentProgram)}
          </CardTitle>
          <CardDescription>
            {labelFor(YEAR_LEVEL_OPTIONS, currentYearLevel ?? "")}
          </CardDescription>
          <CardAction>
            {current ? (
              <EnrollmentStatusBadge status={current.status} />
            ) : (
              <StudentStatusBadge status={student.status} />
            )}
          </CardAction>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
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
            Clearance &amp; Grades
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 justify-center px-1 font-normal tabular-nums"
            >
              {uploadedDocuments}/{TOTAL_DOCUMENT_SLOTS}
            </Badge>
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
          <TabsTrigger value="transfer">
            <ArrowRightLeftIcon />
            Transfer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-base">Enrollment details</CardTitle>
              <CardDescription>
                Your record for the current term.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                <Detail label="Student No." value={student.studentNumber} />
                <Detail label="Program" value={programLabel(currentProgram)} />
                <Detail
                  label="Year Level"
                  value={labelFor(YEAR_LEVEL_OPTIONS, currentYearLevel ?? "")}
                />
                <Detail label="School Year" value={currentSchoolYear ?? "—"} />
                <Detail
                  label="Enrolled On"
                  value={formatDate(current?.enrolledAt ?? null)}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <StudentClassSchedule />
        </TabsContent>

        <TabsContent value="clearance-grades">
          <ClearanceGradesPanel />
        </TabsContent>

        <TabsContent value="history">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
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
        </TabsContent>

        <TabsContent value="transfer">
          <TransferRequestPanel
            currentProgramCode={currentProgram ?? ""}
            currentProgramName={programLabel(currentProgram)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProgramsPage;
