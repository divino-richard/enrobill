import {
  CheckCircle2Icon,
  CircleSlashIcon,
  GraduationCapIcon,
  LogOutIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RowActions } from "@/components/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { semesterLabel } from "@/features/terms/types";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useStudentEnrollments,
  useUpdateEnrollmentStatus,
} from "../hooks";
import { EnrollmentStatusBadge } from "./enrollment-status-badge";
import type { EnrollmentRecord, EnrollmentStatus } from "../types";

// The status transitions an admin can apply, with their menu presentation.
const ACTIONS: {
  status: EnrollmentStatus;
  label: string;
  icon: typeof CheckCircle2Icon;
}[] = [
  { status: "enrolled", label: "Mark as enrolled", icon: CheckCircle2Icon },
  { status: "completed", label: "Mark as completed", icon: GraduationCapIcon },
  { status: "dropped", label: "Mark as dropped", icon: CircleSlashIcon },
  { status: "withdrawn", label: "Mark as withdrawn", icon: LogOutIcon },
  { status: "pending", label: "Reset to pending", icon: RotateCcwIcon },
];

function termLabel(record: EnrollmentRecord): string {
  const sem = record.semester ? semesterLabel(record.semester) : "";
  const sy = record.schoolYear ? `SY ${record.schoolYear}` : "";
  return [sem, sy].filter(Boolean).join(" · ") || "—";
}

export function StudentEnrollmentsCard({ studentId }: { studentId: number }) {
  const programLabel = useProgramLabel();
  const { data: enrollments, isLoading } = useStudentEnrollments(studentId);
  const mutation = useUpdateEnrollmentStatus(studentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Enrollments</CardTitle>
        <CardDescription>
          The student's program, level and status per term. Changing a status
          updates the student's overall standing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mutation.isError && (
          <p className="text-destructive mb-3 text-sm">
            {getErrorMessage(mutation.error)}
          </p>
        )}

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
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
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
                <div className="flex shrink-0 items-center gap-1">
                  <EnrollmentStatusBadge status={record.status} />
                  <RowActions>
                    {ACTIONS.filter((a) => a.status !== record.status).map(
                      (action) => (
                        <DropdownMenuItem
                          key={action.status}
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              enrollmentId: record.id,
                              status: action.status,
                            })
                          }
                        >
                          <action.icon />
                          {action.label}
                        </DropdownMenuItem>
                      ),
                    )}
                  </RowActions>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
