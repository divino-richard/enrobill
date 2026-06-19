import { Navigate } from "react-router-dom";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { useAuthStore } from "@/features/auth/store";

function ApplicationNewPage() {
  // Enrolled students don't apply again — send them to their dashboard.
  const isStudent = useAuthStore((state) => state.user?.role) === "student";
  if (isStudent) {
    return <Navigate to="/portal" replace />;
  }

  return <ApplicationForm />;
}

export default ApplicationNewPage;
