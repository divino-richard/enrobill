import { useAuthStore } from "@/features/auth/store";
import { StudentDashboard } from "@/features/students/components/student-dashboard";
import { ApplicantOverview } from "@/features/applications/components/applicant-overview";

// Portal home is shaped by stage: enrolled students get their dashboard,
// applicants get their application overview.
function PortalHomePage() {
  const role = useAuthStore((state) => state.user?.role);

  return role === "student" ? <StudentDashboard /> : <ApplicantOverview />;
}

export default PortalHomePage;
