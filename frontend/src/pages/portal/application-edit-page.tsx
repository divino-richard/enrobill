import { useNavigate, useParams } from "react-router-dom";
import { ApplicationForm } from "@/features/applications/components/application-form";
import {
  useApplication,
  useApplications,
} from "@/features/applications/hooks/use-applications";
import { isActiveStatus } from "@/features/applications/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ApplicationEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const applicationId = Number(id);
  const { data: application, isLoading, isError, refetch } = useApplication(
    applicationId,
  );
  const { data: applications } = useApplications();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Skeleton className="h-[60vh] w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !application) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load this application. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Only rejected applications can be edited and resubmitted.
  if (application.status !== "rejected") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <p className="text-muted-foreground text-sm">
            This application can no longer be edited.
          </p>
          <Button onClick={() => navigate(`/portal/application/${application.id}`)}>
            View application
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Resubmitting would create a second active application — block it.
  const activeApplication = applications?.find((app) =>
    isActiveStatus(app.status),
  );
  if (activeApplication && activeApplication.id !== application.id) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <p className="text-muted-foreground text-sm">
            You have another application in progress. Please resolve it before
            resubmitting this one.
          </p>
          <Button onClick={() => navigate("/portal/application")}>
            Back to Applications
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ApplicationForm
      mode="edit"
      applicationId={application.id}
      initialValues={application.values}
    />
  );
}

export default ApplicationEditPage;
