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
import { useUnreadNotificationCount } from "@/features/notifications/hooks";
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

const ACTIVE_CLASSES =
  "data-active:bg-sidebar-primary data-active:font-semibold data-active:text-sidebar-primary-foreground data-active:shadow-xs data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground [&>svg]:text-sidebar-foreground/65 data-active:[&>svg]:text-sidebar-primary-foreground";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  // Match exactly (for index routes) rather than by prefix.
  end?: boolean;
  // Show a live count badge of unread notifications.
  notify?: boolean;
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
  { title: "Dropping Requests", url: "/portal/dropping-requests", icon: FileTextIcon },
  { title: "My Bills", url: "/portal/bills", icon: ReceiptTextIcon },
  { title: "Admission", url: "/portal/application", icon: FileTextIcon },
  {
    title: "Notifications",
    url: "/portal/notifications",
    icon: BellIcon,
    notify: true,
  },
];

// A count badge that survives the icon-collapsed sidebar. Expanded, it's a pill
// on the right of the row; collapsed, it becomes a compact bubble tucked over the
// icon's top-right corner (with a ring in the sidebar colour so it reads as an
// overlay). Two elements rather than one so each state gets its own size and
// position; the variant selector out-specifies the base `hidden`.
function NotifyBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <>
      <span className="bg-brand-accent text-brand-accent-foreground border-sidebar pointer-events-none absolute top-2 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[0.6875rem] font-semibold tabular-nums select-none group-data-[collapsible=icon]:hidden">
        {count > 99 ? "99+" : count}
      </span>
      <span className="bg-brand-accent text-brand-accent-foreground border-sidebar pointer-events-none absolute top-0 right-0 hidden h-4 min-w-4 items-center justify-center rounded-full border-2 px-0.5 text-[0.625rem] leading-none font-semibold tabular-nums select-none group-data-[collapsible=icon]:flex">
        {count > 9 ? "9+" : count}
      </span>
    </>
  );
}

export function PortalSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const role = useAuthStore((state) => state.user?.role);
  const isStudent = role === "student";
  const navItems = isStudent ? STUDENT_NAV : APPLICANT_NAV;
  const unreadNotifications = useUnreadNotificationCount(isStudent);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent">
              <NavLink to="/portal">
                <Logo className="size-9 rounded-lg" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-[-0.015em]">Enrobill</span>
                  <span className="text-sidebar-foreground/55 truncate text-[0.6875rem]">
                    {isStudent ? "Student Portal" : "Applicant Portal"}
                  </span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2 py-3 first:pt-2">
          <SidebarGroupLabel className="h-7 px-2 text-[0.6875rem] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase">
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
                    className={ACTIVE_CLASSES}
                  >
                    <NavLink to={item.url} end={item.end}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  {item.notify && <NotifyBadge count={unreadNotifications} />}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
