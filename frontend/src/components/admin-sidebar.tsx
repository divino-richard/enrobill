import type { ComponentProps } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BanknoteIcon,
  BarChart3Icon,
  BookUserIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  MoveUpIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  TagIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavUser } from "@/components/nav-user";
import { useAuthStore } from "@/features/auth/store";
import type { Role } from "@/features/auth/types";
import { useNewApplicationsCount } from "@/features/applications/hooks/use-applications";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url?: string;
  icon: LucideIcon;
  // Match exactly (for index routes) rather than by prefix.
  end?: boolean;
  // Not-yet-built items render disabled with a "Soon" badge.
  ready?: boolean;
  roles?: Role[];
  // Show a live count badge of new (submitted) applications waiting for review.
  notify?: "newApplications";
}

interface NavGroup {
  label: string;
  // Roles allowed to see this group. Cashiers see accounting only.
  roles: Role[];
  items: NavItem[];
}

// Sidebar grouped by area of work so admins can find things quickly.
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    roles: ["admin", "cashier"],
    items: [
      {
        title: "Dashboard",
        url: "/admin",
        icon: LayoutDashboardIcon,
        end: true,
        ready: true,
      },
      {
        title: "Reports",
        url: "/admin/reports",
        icon: BarChart3Icon,
        ready: true,
      },
    ],
  },
  {
    label: "Admissions",
    roles: ["admin", "cashier"],
    items: [
      {
        title: "Applications",
        url: "/admin/applications",
        icon: ClipboardListIcon,
        ready: true,
        roles: ["admin"],
        notify: "newApplications",
      },
      {
        title: "Students",
        url: "/admin/students",
        icon: GraduationCapIcon,
        ready: true,
      },
      {
        title: "Progression",
        url: "/admin/progression",
        icon: MoveUpIcon,
        ready: true,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Academics",
    roles: ["admin"],
    items: [
      {
        title: "Programs",
        url: "/admin/programs",
        icon: LayersIcon,
        ready: true,
      },
      {
        title: "Academic Years",
        url: "/admin/terms",
        icon: CalendarRangeIcon,
        ready: true,
      },
      {
        title: "Sections",
        url: "/admin/sections",
        icon: LayoutGridIcon,
        ready: true,
      },
      {
        title: "Scheduling",
        url: "/admin/scheduling",
        icon: CalendarClockIcon,
        ready: true,
      },
    ],
  },
  {
    label: "Finance",
    roles: ["admin", "cashier"],
    items: [
      {
        title: "Enrollments",
        url: "/admin/enrollments",
        icon: BookUserIcon,
        ready: true,
      },
      {
        title: "Fees",
        url: "/admin/fees",
        icon: ReceiptTextIcon,
        ready: true,
      },
      {
        title: "Vouchers",
        url: "/admin/discounts",
        icon: TagIcon,
        ready: true,
      },
      {
        title: "Billing",
        url: "/admin/billing",
        icon: BanknoteIcon,
        ready: true,
      },
      {
        title: "Payment Methods",
        url: "/admin/payment-methods",
        icon: QrCodeIcon,
        ready: true,
      },
    ],
  },
  {
    label: "System",
    roles: ["admin"],
    items: [
      {
        title: "Users",
        url: "/admin/users",
        icon: UsersIcon,
        ready: true,
      },
    ],
  },
];

// Highlight treatment applied to the active nav item (shared look with the
// portal sidebar).
const ACTIVE_CLASSES =
  "relative data-active:bg-primary/10 data-active:font-medium data-active:text-primary data-active:hover:bg-primary/15 data-active:hover:text-primary data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 data-active:before:w-1 data-active:before:rounded-r-full data-active:before:bg-primary data-active:before:content-['']";

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
      <span className="bg-primary text-primary-foreground border-sidebar pointer-events-none absolute top-1.5 right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs  border-2 font-medium tabular-nums select-none group-data-[collapsible=icon]:hidden">
        {count > 99 ? "99+" : count}
      </span>
      <span className="bg-primary text-primary-foreground border-sidebar pointer-events-none absolute top-0.5 right-0.5 hidden h-4 min-w-4 items-center justify-center rounded-full border-2 px-0.5 text-[10px] leading-none font-medium tabular-nums select-none group-data-[collapsible=icon]:flex">
        {count > 9 ? "9+" : count}
      </span>
    </>
  );
}

export function AdminSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const role = useAuthStore((state) => state.user?.role);
  // Only admins see Applications, so the count query only runs for them.
  const { data: newApplications = 0 } = useNewApplicationsCount(role === "admin");
  const groups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          role !== undefined && (item.roles ?? group.roles).includes(role),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/admin">
                <Logo className="size-8 rounded-md" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Enrobill</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {role === "cashier" ? "Cashier Console" : "Admin Console"}
                  </span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                if (!item.ready || !item.url) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        disabled
                        tooltip={`${item.title} — coming soon`}
                        className="opacity-60"
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>Soon</SidebarMenuBadge>
                    </SidebarMenuItem>
                  );
                }

                const isActive = item.end
                  ? pathname === item.url
                  : pathname.startsWith(item.url);

                const notifyCount =
                  item.notify === "newApplications" ? newApplications : 0;

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
                    <NotifyBadge count={notifyCount} />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
