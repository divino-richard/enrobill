import { Outlet } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { useAuthStore } from "@/features/auth/store";

// Back-office shell for the staff workspace, with role-specific navigation.
export function StaffLayout() {
  const role = useAuthStore((state) => state.user?.role);

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-6 my-auto" />
          <span className="text-sm font-medium">
            {role === "teacher" ? "Teacher Workspace" : "Admin Console"}
          </span>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
