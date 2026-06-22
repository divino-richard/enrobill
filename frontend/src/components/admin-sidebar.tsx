import type { ComponentProps } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BanknoteIcon,
  BarChart3Icon,
  CalendarRangeIcon,
  CircleFadingArrowUp,
  ClipboardListIcon,
  GraduationCapIcon,
  LayersIcon,
  LayoutDashboardIcon,
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
      { title: "Reports", icon: BarChart3Icon },
    ],
  },
  {
    label: "Enrollment",
    roles: ["admin"],
    items: [
      {
        title: "Applications",
        url: "/admin/applications",
        icon: ClipboardListIcon,
        ready: true,
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
        icon: CircleFadingArrowUp,
        ready: true,
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
    ],
  },
  {
    label: "Finance",
    roles: ["admin", "cashier"],
    items: [
      {
        title: "Fees",
        url: "/admin/fees",
        icon: ReceiptTextIcon,
        ready: true,
      },
      {
        title: "Discounts",
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

export function AdminSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const role = useAuthStore((state) => state.user?.role);
  const groups = navGroups.filter(
    (group) => role !== undefined && group.roles.includes(role),
  );

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
