import { Navigate } from "react-router-dom";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { AdmissionsClosedNotice } from "@/features/applications/components/admissions-closed-notice";
import { useOpenTerm } from "@/features/terms/hooks";
import { useAuthStore } from "@/features/auth/store";
import { Skeleton } from "@/components/ui/skeleton";

function ApplicationNewPage() {
  // Enrolled students don't apply again — send them to their dashboard.
  const isStudent = useAuthStore((state) => state.user?.role) === "student";
  const { data: openTerm, isLoading } = useOpenTerm();

  if (isStudent) {
    return <Navigate to="/portal" replace />;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Skeleton className="h-[60vh] w-full rounded-lg" />
      </div>
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
