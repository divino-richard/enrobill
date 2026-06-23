import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { StudentEditForm } from "@/features/students/components/student-edit-form";
import { StudentEnrollmentsCard } from "@/features/students/components/student-enrollments-card";
import { BillCard } from "@/features/bills/components/bill-card";
import { useStudent } from "@/features/students/hooks";
import { studentFullName } from "@/features/students/types";

function StudentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: student, isLoading, isError, refetch } = useStudent(Number(id));

  return (
    <div className="mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => navigate("/admin/students")}
      >
        <ArrowLeftIcon />
        Back to Students
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      ) : isError || !student ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <p className="text-muted-foreground text-sm">
              We couldn't load this student. Please try again.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                {student.studentNumber}
              </CardDescription>
              <CardTitle className="text-lg">
                {studentFullName(student)}
              </CardTitle>
              <CardAction>
                <StudentStatusBadge status={student.status} />
              </CardAction>
            </CardHeader>
          </Card>

          <StudentEnrollmentsCard studentId={student.id} />

          <BillCard studentId={student.id} />

          <Card>
            <CardContent>
              <StudentEditForm student={student} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default StudentDetailPage;
