import { Navigate } from "react-router-dom";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { AdmissionsClosedNotice } from "@/features/applications/components/admissions-closed-notice";
import { useOpenTerm } from "@/features/terms/hooks";
import { useApplications } from "@/features/applications/hooks/use-applications";
import { isActiveStatus } from "@/features/applications/types";
import { useAuthStore } from "@/features/auth/store";
import { Skeleton } from "@/components/ui/skeleton";

function ApplicationNewPage() {
  // Enrolled students don't apply again — send them to their dashboard.
  const isStudent = useAuthStore((state) => state.user?.role) === "student";
  const { data: openTerm, isLoading: termLoading } = useOpenTerm();
  const { data: applications, isLoading: appsLoading } = useApplications();

  if (isStudent) {
    return <Navigate to="/portal" replace />;
  }

  if (termLoading || appsLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Skeleton className="h-[60vh] w-full rounded-lg" />
      </div>
    );
  }

  // Only one application may be in progress at a time. If the applicant already
  // has an active one, block starting another (direct URL, back button, etc.)
  // and take them to the application they already have.
  const activeApplication = (applications ?? []).find((app) =>
    isActiveStatus(app.status),
  );
  if (activeApplication) {
    return (
      <Navigate to={`/portal/application/${activeApplication.id}`} replace />
    );
  }

  // Admissions closed — block the form and explain why, rather than dropping
  // the applicant into a form they can't submit.
  if (!openTerm) {
    return <AdmissionsClosedNotice />;
  }

  return <ApplicationForm />;
}

export default ApplicationNewPage;
