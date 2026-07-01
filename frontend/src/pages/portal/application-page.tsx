import { useNavigate } from "react-router-dom";
import { ApplicationsEmptyState } from "@/features/applications/components/applications-empty-state";
import { ApplicationsHeader } from "@/features/applications/components/applications-header";
import { ApplicationsTable } from "@/features/applications/components/applications-table";
import { isActiveStatus } from "@/features/applications/types";
import { useApplications } from "@/features/applications/hooks/use-applications";
import { useOpenTerm } from "@/features/terms/hooks";
import { useAuthStore } from "@/features/auth/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function ApplicationPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useApplications();
  const { data: openTerm } = useOpenTerm();
  const isStudent = useAuthStore((state) => state.user?.role) === "student";

  const startNewApplication = () => navigate("/portal/application/new");

  const applications = data ?? [];
  const hasActiveApplication = applications.some((app) =>
    isActiveStatus(app.status),
  );

  // Applicants can only start an application while admissions are open.
  const admissionsClosed = !isStudent && openTerm === null;

  return (
    <div className="space-y-8 mx-auto max-w-7xl">
      <ApplicationsHeader
        hasActiveApplication={hasActiveApplication}
        onNewApplication={startNewApplication}
        canCreate={!isStudent}
        admissionsClosed={admissionsClosed}
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load your applications. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : applications.length === 0 ? (
        <ApplicationsEmptyState admissionsClosed={admissionsClosed} />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <ApplicationsTable
            applications={applications}
            onView={(id) => navigate(`/portal/application/${id}`)}
          />
        </div>
      )}
    </div>
  );
}

export default ApplicationPage;
