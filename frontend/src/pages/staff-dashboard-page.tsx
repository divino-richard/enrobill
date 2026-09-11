import DashboardPage from "@/pages/admin/dashboard-page";
import TeacherDashboardPage from "@/pages/teacher/dashboard-page";
import { useAuthStore } from "@/features/auth/store";

export default function StaffDashboardPage() {
  const role = useAuthStore((state) => state.user?.role);

  return role === "teacher" ? <TeacherDashboardPage /> : <DashboardPage />;
}
