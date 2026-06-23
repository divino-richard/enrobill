import { useNavigate } from "react-router-dom";
import { ApplicationsEmptyState } from "@/features/applications/components/applications-empty-state";
import { ApplicationsHeader } from "@/features/applications/components/applications-header";
import { ApplicationsTable } from "@/features/applications/components/applications-table";
import { CurrentApplicationCard } from "@/features/applications/components/current-application-card";
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
  const activeApplication = applications.find((app) =>
    isActiveStatus(app.status),
  );
  const previousApplications = applications.filter(
    (app) => app.id !== activeApplication?.id,
  );

  // Applicants can only start an application while admissions are open.
  const admissionsClosed = !isStudent && openTerm === null;

  return (
    <div className="mx-auto space-y-8">
      <ApplicationsHeader
        hasActiveApplication={Boolean(activeApplication)}
        onNewApplication={startNewApplication}
        canCreate={!isStudent}
        admissionsClosed={admissionsClosed}
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
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
        <ApplicationsEmptyState
          onNewApplication={isStudent ? undefined : startNewApplication}
          admissionsClosed={admissionsClosed}
        />
      ) : (
        <>
          {activeApplication && (
            <CurrentApplicationCard
              application={activeApplication}
              onView={() =>
                navigate(`/portal/application/${activeApplication.id}`)
              }
            />
          )}

          {previousApplications.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-muted-foreground text-sm font-medium">
                Application history
              </h2>
              <div className="overflow-hidden rounded-lg border">
                <ApplicationsTable
                  applications={previousApplications}
                  onView={(id) => navigate(`/portal/application/${id}`)}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default ApplicationPage;
