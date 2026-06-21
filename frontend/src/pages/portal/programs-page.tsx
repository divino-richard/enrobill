import { CalendarClockIcon, GraduationCapIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useMyStudent } from "@/features/students/hooks";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function ProgramsPage() {
  const { data: student, isLoading, isError } = useMyStudent();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Program</h1>
        <p className="text-muted-foreground text-sm">
          The program you're enrolled in this school year.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {programLabel(student.trackOrStrand)}
          </CardTitle>
          <CardDescription>
            {labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel ?? "")}
            {student.schoolYear ? ` · SY ${student.schoolYear}` : ""}
          </CardDescription>
          <CardAction>
            <StudentStatusBadge status={student.status} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Detail label="Student No." value={student.studentNumber} />
            <Detail
              label="Program"
              value={programLabel(student.trackOrStrand)}
            />
            <Detail
              label="Year Level"
              value={labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel ?? "")}
            />
            <Detail label="School Year" value={student.schoolYear ?? "—"} />
          </dl>
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
