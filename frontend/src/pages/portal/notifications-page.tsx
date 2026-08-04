import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowRightLeftIcon,
  BellIcon,
  BookCheckIcon,
  FileTextIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/features/auth/store";
import { cn } from "@/lib/utils";

type NotificationCategory =
  | "billing"
  | "enrollment"
  | "documents"
  | "transfer"
  | "account";

interface PortalNotification {
  id: number;
  title: string;
  message: string;
  timeLabel: string;
  category: NotificationCategory;
  unread: boolean;
  actionRequired?: boolean;
  ctaLabel?: string;
}

const INITIAL_NOTIFICATIONS: PortalNotification[] = [
  {
    id: 1,
    title: "Payment verified",
    message: "Your GCash payment was verified and posted to your bill.",
    timeLabel: "10 minutes ago",
    category: "billing",
    unread: true,
    ctaLabel: "View bill",
  },
  {
    id: 2,
    title: "Installment due in 3 days",
    message: "Settle your next installment to avoid a late balance.",
    timeLabel: "Today · 8:20 AM",
    category: "billing",
    unread: true,
    actionRequired: true,
    ctaLabel: "Pay now",
  },
  {
    id: 3,
    title: "Enrollment status: Enrolled",
    message: "Your payment cleared the threshold — you're now Enrolled.",
    timeLabel: "Yesterday",
    category: "enrollment",
    unread: true,
    ctaLabel: "View enrollment",
  },
  {
    id: 4,
    title: "Clearance returned",
    message: "Missing adviser signature. Upload a corrected copy.",
    timeLabel: "Yesterday",
    category: "documents",
    unread: true,
    actionRequired: true,
    ctaLabel: "View documents",
  },
  {
    id: 5,
    title: "Transfer approved",
    message: "Your transfer from BE-ABM to ASSH is now in effect.",
    timeLabel: "2 days ago",
    category: "transfer",
    unread: false,
    ctaLabel: "View transfer status",
  },
  {
    id: 6,
    title: "Password changed",
    message: "Your account password was updated successfully.",
    timeLabel: "3 days ago",
    category: "account",
    unread: false,
  },
];

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  billing: "Billing",
  enrollment: "Enrollment",
  documents: "Clearance & Grades",
  transfer: "Program Transfer",
  account: "Account",
};

// Category is conveyed by icon + label only — color is reserved for status
// (unread, action required), not used to distinguish notification types.
const CATEGORY_ICONS: Record<NotificationCategory, typeof BellIcon> = {
  billing: ReceiptTextIcon,
  enrollment: BookCheckIcon,
  documents: FileTextIcon,
  transfer: ArrowRightLeftIcon,
  account: ShieldCheckIcon,
};

function NotificationsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const [tab, setTab] = useState<
    "all" | "unread" | NotificationCategory
  >("all");
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const visibleNotifications = useMemo(() => {
    if (tab === "all") return notifications;
    if (tab === "unread") return notifications.filter((item) => item.unread);
    return notifications.filter((item) => item.category === tab);
  }, [tab, notifications]);

  const hasUnread = notifications.some((item) => item.unread);

  function markAsRead(id: number) {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
  }

  function markAllAsRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
  }

  if (role !== "student") {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="space-y-6 mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Notifications
            </h1>
            <Badge variant="outline">UI Preview</Badge>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            A student-facing inbox for billing updates, enrollment milestones,
            clearance &amp; grades review, and transfer request decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={!hasUnread}
            onClick={markAllAsRead}
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
          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <div className="border-b px-4 py-3">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
                <TabsTrigger value="documents">Clearance & Grades</TabsTrigger>
                <TabsTrigger value="transfer">Transfer</TabsTrigger>
              </TabsList>
            </div>

            {[
              "all",
              "unread",
              "billing",
              "enrollment",
              "documents",
              "transfer",
            ].map((value) => (
              <TabsContent key={value} value={value} className="m-0">
                {visibleNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                    <p className="font-medium">No notifications here.</p>
                    <p className="text-muted-foreground text-sm">
                      This filtered view is empty in the current preview.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {visibleNotifications.map((item) => (
                      <li
                        key={item.id}
                        onClick={() => item.unread && markAsRead(item.id)}
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
                              <div className="text-muted-foreground text-xs">
                                {item.timeLabel}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {CATEGORY_LABELS[item.category]}
                              </Badge>
                              {item.ctaLabel && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  className="h-7 px-2 text-xs"
                                >
                                  {item.ctaLabel}
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
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationAvatar({ item }: { item: PortalNotification }) {
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
