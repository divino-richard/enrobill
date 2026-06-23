import {
  CalendarClockIcon,
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
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useMyEnrollments, useMyStudent } from "@/features/students/hooks";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { EnrollmentStatusBadge } from "@/features/students/components/enrollment-status-badge";
import type { EnrollmentRecord } from "@/features/students/types";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function termLabel(record: EnrollmentRecord): string {
  return record.schoolYear ? `SY ${record.schoolYear}` : "—";
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
  const { data: student, isLoading, isError } = useMyStudent();
  const { data: enrollments } = useMyEnrollments();
  const programLabel = useProgramLabel();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Program</h1>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Program</h1>
        <p className="text-muted-foreground text-sm">
          The program and level you're enrolled in.
        </p>
      </div>

      {/* Headline — always visible so the current term is clear at a glance. */}
      <Card>
        <CardHeader>
          <CardDescription className="text-xs font-medium tracking-wide uppercase">
            {currentSchoolYear ? `SY ${currentSchoolYear}` : "Current term"}
          </CardDescription>
          <CardTitle className="text-base">
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <GraduationCapIcon />
            Overview
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarClockIcon />
            Schedule
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
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enrollment details</CardTitle>
              <CardDescription>
                Your record for the current term.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Student No." value={student.studentNumber} />
                <Detail label="Program" value={programLabel(currentProgram)} />
                <Detail
                  label="Year Level"
                  value={labelFor(YEAR_LEVEL_OPTIONS, currentYearLevel ?? "")}
                />
                <Detail label="School Year" value={currentSchoolYear ?? "—"} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
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

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class schedule</CardTitle>
              <CardDescription>Your subjects and timetable.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyTab
                icon={CalendarClockIcon}
                title="Schedules coming soon"
                message="Your class schedule will be available here once it's published."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProgramsPage;
