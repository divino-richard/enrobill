import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { AdminDroppingAction } from "@/features/dropping/admin-dropping-action";
import { useStudentEnrollments } from "../hooks";
import { EnrollmentStatusBadge } from "./enrollment-status-badge";
import type { EnrollmentRecord } from "../types";

function termLabel(record: EnrollmentRecord): string {
  return record.schoolYear ? `SY ${record.schoolYear}` : "—";
}

export function StudentEnrollmentsCard({
  studentId,
  studentName,
}: {
  studentId: number;
  studentName: string;
}) {
  const programLabel = useProgramLabel();
  const { data: enrollments, isLoading } = useStudentEnrollments(studentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Enrollments</CardTitle>
        <CardDescription>
          The student's program, level and status per term.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : !enrollments || enrollments.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No enrollments yet. One is created when the student is admitted to an
            open term or billed.
          </p>
        ) : (
          <ul className="divide-y">
            {enrollments.map((record) => (
              <li
                key={record.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {programLabel(record.program)}
                    {record.isCurrent && (
                      <Badge
                        variant="secondary"
                        className="ml-2 align-middle font-normal"
                      >
                        Current
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {labelFor(YEAR_LEVEL_OPTIONS, record.yearLevel ?? "")} ·{" "}
                    {termLabel(record)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <EnrollmentStatusBadge status={record.status} />
                  <AdminDroppingAction studentId={studentId} studentName={studentName} enrollment={record} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
