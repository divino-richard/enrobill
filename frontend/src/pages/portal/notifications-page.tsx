import { PageHeader } from "@/components/page-header";
import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRightLeftIcon,
  BellIcon,
  BookCheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  MoveUpIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/features/auth/store";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
} from "@/features/notifications/hooks";
import type {
  NotificationCategory,
  StudentNotification,
} from "@/features/notifications/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  billing: "Billing",
  enrollment: "Enrollment",
  applications: "Applications",
  documents: "Clearance & Grades",
  transfer: "Program Transfer",
  progression: "Progression",
  account: "Account",
};

// Category is conveyed by icon + label only — color is reserved for status
// (unread, action required), not used to distinguish notification types.
const CATEGORY_ICONS: Record<NotificationCategory, typeof BellIcon> = {
  billing: ReceiptTextIcon,
  enrollment: BookCheckIcon,
  applications: ClipboardListIcon,
  documents: FileTextIcon,
  transfer: ArrowRightLeftIcon,
  progression: MoveUpIcon,
  account: ShieldCheckIcon,
};

const TAB_VALUES: ("all" | "unread" | NotificationCategory)[] = [
  "all",
  "unread",
  "billing",
  "enrollment",
  "applications",
  "documents",
  "transfer",
  "progression",
  "account",
];

function timeLabel(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
}

function NotificationsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const [tab, setTab] = useState<"all" | "unread" | NotificationCategory>(
    "all",
  );
  const {
    data: notifications,
    isLoading,
    isError,
    refetch,
  } = useMyNotifications(role === "student");
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const visibleNotifications = useMemo(() => {
    const items = notifications ?? [];
    if (tab === "all") return items;
    if (tab === "unread") return items.filter((item) => item.unread);
    return items.filter((item) => item.category === tab);
  }, [tab, notifications]);

  const hasUnread = (notifications ?? []).some((item) => item.unread);

  if (role !== "student") {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <PageHeader title="Notifications" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={!hasUnread || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <BellIcon />
            Mark all as read
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">Inbox</CardTitle>
          <CardDescription>
            Filter your student updates by status or category.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <p className="text-muted-foreground text-sm">
                We couldn't load your notifications. Please try again.
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as typeof tab)}
            >
              <div className="border-b px-4 py-3">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unread">Unread</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                  <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
                  <TabsTrigger value="applications">Applications</TabsTrigger>
                  <TabsTrigger value="documents">
                    Clearance &amp; Grades
                  </TabsTrigger>
                  <TabsTrigger value="transfer">Transfer</TabsTrigger>
                  <TabsTrigger value="progression">Progression</TabsTrigger>
                  <TabsTrigger value="account">Account</TabsTrigger>
                </TabsList>
              </div>

              {TAB_VALUES.map((value) => (
                <TabsContent key={value} value={value} className="m-0">
                  {visibleNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                      <p className="font-medium">No notifications here.</p>
                      <p className="text-muted-foreground text-sm">
                        You'll see updates here as they happen.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {visibleNotifications.map((item) => (
                        <li
                          key={item.id}
                          onClick={() =>
                            item.unread && markRead.mutate(item.id)
                          }
                          className={cn(
                            "px-4 py-4 transition-colors hover:bg-muted/25",
                            item.unread && "cursor-pointer bg-primary/[0.03]",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <NotificationAvatar item={item} />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate font-medium">
                                      {item.title}
                                    </p>
                                    {item.unread && (
                                      <span className="bg-primary size-2 rounded-full" />
                                    )}
                                    {item.actionRequired && (
                                      <Badge
                                        variant="outline"
                                        className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                      >
                                        Action required
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                                    {item.message}
                                  </p>
                                </div>
                                <div className="text-muted-foreground text-xs whitespace-nowrap">
                                  {timeLabel(item.createdAt)}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  {CATEGORY_LABELS[item.category]}
                                </Badge>
                                {item.ctaLabel && item.ctaUrl && (
                                  <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Link
                                      to={item.ctaUrl}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {item.ctaLabel}
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationAvatar({ item }: { item: StudentNotification }) {
  const Icon = CATEGORY_ICONS[item.category];

  return (
    <Avatar className="mt-0.5 rounded-2xl">
      <AvatarFallback className="bg-muted text-muted-foreground rounded-2xl text-xs font-semibold">
        <Icon className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

export default NotificationsPage;
