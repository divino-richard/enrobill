import { CalendarClockIcon, GraduationCapIcon, HistoryIcon } from "lucide-react";
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
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useMyEnrollments, useMyStudent } from "@/features/students/hooks";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { EnrollmentStatusBadge } from "@/features/students/components/enrollment-status-badge";
import { semesterLabel } from "@/features/terms/types";
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
  const sem = record.semester ? semesterLabel(record.semester) : "";
  const sy = record.schoolYear ? `SY ${record.schoolYear}` : "";
  return [sem, sy].filter(Boolean).join(" · ") || "—";
}

function ProgramsPage() {
  const { data: student, isLoading, isError } = useMyStudent();
  const { data: enrollments } = useMyEnrollments();
  const programLabel = useProgramLabel();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Program</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
            <GraduationCapIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Not enrolled yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              Once your enrollment is processed, your program will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const records = enrollments ?? [];
  // The enrollment for the open term, if any — otherwise fall back to the
  // student's own record for the headline card.
  const current = records.find((r) => r.isCurrent) ?? null;
  const history = records.filter((r) => r !== current);

  const currentProgram = current?.program ?? student.trackOrStrand;
  const currentYearLevel = current?.yearLevel ?? student.yearLevel;
  const currentSemester = current?.semester ?? null;
  const currentSchoolYear = current?.schoolYear ?? student.schoolYear;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Program</h1>
        <p className="text-muted-foreground text-sm">
          The program, level and semester you're enrolled in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {programLabel(currentProgram)}
          </CardTitle>
          <CardDescription>
            {labelFor(YEAR_LEVEL_OPTIONS, currentYearLevel ?? "")}
            {currentSemester ? ` · ${semesterLabel(currentSemester)}` : ""}
            {currentSchoolYear ? ` · SY ${currentSchoolYear}` : ""}
          </CardDescription>
          <CardAction>
            {current ? (
              <EnrollmentStatusBadge status={current.status} />
            ) : (
              <StudentStatusBadge status={student.status} />
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail label="Student No." value={student.studentNumber} />
            <Detail label="Program" value={programLabel(currentProgram)} />
            <Detail
              label="Year Level"
              value={labelFor(YEAR_LEVEL_OPTIONS, currentYearLevel ?? "")}
            />
            <Detail
              label="Semester"
              value={currentSemester ? semesterLabel(currentSemester) : "—"}
            />
            <Detail label="School Year" value={currentSchoolYear ?? "—"} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment history</CardTitle>
          <CardDescription>
            Your program and level across past terms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
                <HistoryIcon className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No past enrollments</p>
                <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                  Previous terms will be listed here as you progress.
                </p>
              </div>
            </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class schedule</CardTitle>
          <CardDescription>Your subjects and timetable.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <CalendarClockIcon className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Schedules coming soon</p>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                Your class schedule will be available here once it's published.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProgramsPage;
