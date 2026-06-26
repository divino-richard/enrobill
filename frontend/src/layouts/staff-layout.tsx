import { Outlet } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";

// Back-office shell for the staff workspace (admin + cashier), with the sidebar.
export function StaffLayout() {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-6 my-auto" />
          <span className="text-sm font-medium">Admin Console</span>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
