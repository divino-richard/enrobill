import { useNavigate } from "react-router-dom";
import { ApplicationsEmptyState } from "@/features/applications/components/applications-empty-state";
import { ApplicationsHeader } from "@/features/applications/components/applications-header";
import { ApplicationsTable } from "@/features/applications/components/applications-table";
import { CurrentApplicationCard } from "@/features/applications/components/current-application-card";
import { isActiveStatus } from "@/features/applications/types";
import { MOCK_APPLICATIONS } from "@/features/applications/constants";

function ApplicationPage() {
  const navigate = useNavigate();
  // Mocked for now — this will come from the API.
  const applications = MOCK_APPLICATIONS;
  const activeApplication = applications.find((app) =>
    isActiveStatus(app.status),
  );
  const previousApplications = applications.filter(
    (app) => app.id !== activeApplication?.id,
  );

  const startNewApplication = () => navigate("/portal/application/new");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <ApplicationsHeader
        hasActiveApplication={Boolean(activeApplication)}
        onNewApplication={startNewApplication}
      />

      {applications.length === 0 ? (
        <ApplicationsEmptyState onNewApplication={startNewApplication} />
      ) : (
        <>
          {activeApplication && (
            <CurrentApplicationCard application={activeApplication} />
          )}

          {previousApplications.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-muted-foreground text-sm font-medium">
                Application history
              </h2>
              <div className="overflow-hidden rounded-lg border">
                <ApplicationsTable applications={previousApplications} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default ApplicationPage;
