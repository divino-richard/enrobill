import type { ComponentProps } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BellIcon,
  FileTextIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavUser } from "@/components/nav-user";
import { useAuthStore } from "@/features/auth/store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  // Match exactly (for index routes) rather than by prefix.
  end?: boolean;
}

// Applicants are working toward admission; students are already enrolled, so
// each sees a portal shaped around their stage.
const APPLICANT_NAV: NavItem[] = [
  { title: "Overview", url: "/portal", icon: LayoutDashboardIcon, end: true },
  { title: "Applications", url: "/portal/application", icon: FileTextIcon },
];

const STUDENT_NAV: NavItem[] = [
  { title: "Dashboard", url: "/portal", icon: LayoutDashboardIcon, end: true },
  { title: "My Program", url: "/portal/programs", icon: GraduationCapIcon },
  { title: "My Bills", url: "/portal/bills", icon: ReceiptTextIcon },
  { title: "Admission", url: "/portal/application", icon: FileTextIcon },
  { title: "Notifications", url: "/portal/notifications", icon: BellIcon },
];

export function PortalSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const role = useAuthStore((state) => state.user?.role);
  const isStudent = role === "student";
  const navItems = isStudent ? STUDENT_NAV : APPLICANT_NAV;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/portal">
                <Logo className="size-8 rounded-md" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Enrobill</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {isStudent ? "Student Portal" : "Applicant Portal"}
                  </span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isStudent ? "Enrollment" : "Application"}
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = item.end
                ? pathname === item.url
                : pathname.startsWith(item.url);

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.title}
                    className="relative data-active:bg-primary/10 data-active:font-medium data-active:text-primary data-active:hover:bg-primary/15 data-active:hover:text-primary data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 data-active:before:w-1 data-active:before:rounded-r-full data-active:before:bg-primary data-active:before:content-['']"
                  >
                    <NavLink to={item.url} end={item.end}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
