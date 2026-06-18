import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { useStudents } from "@/features/students/hooks";
import { studentFullName } from "@/features/students/types";
import { formatDate } from "@/features/applications/utils";

function StudentsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useStudents();
  const students = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-muted-foreground text-sm">
            Manage admitted and enrolled student records.
          </p>
        </div>
        {!isLoading && !isError && (
          <span className="text-muted-foreground text-sm">
            {students.length} {students.length === 1 ? "student" : "students"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load students. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No students yet</p>
          <p className="text-muted-foreground text-sm">
            Students appear here once their applications are accepted.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Track / Strand</TableHead>
                <TableHead>Year Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.studentNumber}
                  </TableCell>
                  <TableCell>{studentFullName(student)}</TableCell>
                  <TableCell className="text-muted-foreground uppercase">
                    {student.trackOrStrand ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.yearLevel?.replace("_", " ") ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StudentStatusBadge status={student.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(student.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/students/${student.id}`)}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default StudentsPage;
