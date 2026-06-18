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
import { ApplicationStatusBadge } from "@/features/applications/components/application-status-badge";
import { useAllApplications } from "@/features/applications/hooks/use-applications";
import { formatDate } from "@/features/applications/utils";

function AdminApplicationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAllApplications();
  const applications = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-muted-foreground text-sm">
            Review enrollment applications submitted by aspiring students.
          </p>
        </div>
        {!isLoading && !isError && (
          <span className="text-muted-foreground text-sm">
            {applications.length}{" "}
            {applications.length === 1 ? "application" : "applications"}
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
            We couldn't load applications. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No applications yet</p>
          <p className="text-muted-foreground text-sm">
            Submitted applications will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>School Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="font-medium">
                    {application.reference}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {application.applicant.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {application.applicant.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{application.program}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {application.schoolYear} · {application.semester}
                  </TableCell>
                  <TableCell>
                    <ApplicationStatusBadge status={application.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(application.submittedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        navigate(`/admin/applications/${application.id}`)
                      }
                    >
                      Review
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

export default AdminApplicationsPage;
