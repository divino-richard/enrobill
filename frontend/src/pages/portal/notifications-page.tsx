import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  BellIcon,
  BookCheckIcon,
  CircleAlertIcon,
  CreditCardIcon,
  GraduationCapIcon,
  MegaphoneIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/features/auth/store";
import { cn } from "@/lib/utils";

type NotificationCategory =
  | "billing"
  | "academics"
  | "enrollment"
  | "account"
  | "announcement";

interface PortalNotification {
  id: number;
  title: string;
  message: string;
  timeLabel: string;
  category: NotificationCategory;
  source: string;
  unread: boolean;
  actionRequired?: boolean;
  ctaLabel?: string;
}

const NOTIFICATIONS: PortalNotification[] = [
  {
    id: 1,
    title: "Payment verified for SY 2026-2027",
    message:
      "Your GCash payment for the current term has been verified and posted to your bill.",
    timeLabel: "10 minutes ago",
    category: "billing",
    source: "Cashier Desk",
    unread: true,
    ctaLabel: "View bill",
  },
  {
    id: 2,
    title: "Downpayment due in 3 days",
    message:
      "Your next installment is approaching. Please settle the amount due to avoid delays in enrollment processing.",
    timeLabel: "Today · 8:20 AM",
    category: "billing",
    source: "Billing",
    unread: true,
    actionRequired: true,
    ctaLabel: "Pay now",
  },
  {
    id: 3,
    title: "Enrollment marked as enrolled",
    message:
      "Your enrollment status has been updated after meeting the required payment threshold.",
    timeLabel: "Yesterday",
    category: "enrollment",
    source: "Registrar",
    unread: true,
    ctaLabel: "Open dashboard",
  },
  {
    id: 4,
    title: "Class orientation reminder",
    message:
      "Orientation for Grade 11 students starts on Monday at 9:00 AM in the main auditorium.",
    timeLabel: "Yesterday",
    category: "academics",
    source: "Student Affairs",
    unread: false,
  },
  {
    id: 5,
    title: "Portal security check complete",
    message:
      "Your password update was recorded successfully. No further action is needed.",
    timeLabel: "2 days ago",
    category: "account",
    source: "Account Security",
    unread: false,
  },
  {
    id: 6,
    title: "Campus memo: ID validation week",
    message:
      "Students are advised to bring their registration form and temporary ID for validation this week.",
    timeLabel: "3 days ago",
    category: "announcement",
    source: "Campus Bulletin",
    unread: false,
  },
];

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  billing: "Billing",
  academics: "Academics",
  enrollment: "Enrollment",
  account: "Account",
  announcement: "Announcements",
};

const CATEGORY_STYLES: Record<
  NotificationCategory,
  { badgeClass: string; chipClass: string; icon: typeof BellIcon }
> = {
  billing: {
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    chipClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: ReceiptTextIcon,
  },
  academics: {
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    chipClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    icon: GraduationCapIcon,
  },
  enrollment: {
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
    chipClass: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    icon: BookCheckIcon,
  },
  account: {
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    chipClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    icon: ShieldCheckIcon,
  },
  announcement: {
    badgeClass:
      "border-border bg-muted text-muted-foreground",
    chipClass: "bg-muted text-muted-foreground",
    icon: MegaphoneIcon,
  },
};

function NotificationsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const [tab, setTab] = useState<
    "all" | "unread" | NotificationCategory
  >("all");

  const unreadCount = NOTIFICATIONS.filter((item) => item.unread).length;
  const actionRequiredCount = NOTIFICATIONS.filter(
    (item) => item.actionRequired,
  ).length;
  const thisWeekCount = NOTIFICATIONS.length;
  const billingCount = NOTIFICATIONS.filter(
    (item) => item.category === "billing",
  ).length;

  const visibleNotifications = useMemo(() => {
    if (tab === "all") return NOTIFICATIONS;
    if (tab === "unread") return NOTIFICATIONS.filter((item) => item.unread);
    return NOTIFICATIONS.filter((item) => item.category === tab);
  }, [tab]);

  if (role !== "student") {
    return <Navigate to="/portal" replace />;
  }

  const spotlight = NOTIFICATIONS.find((item) => item.actionRequired) ?? NOTIFICATIONS[0];

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
            reminders, and campus announcements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            <BellIcon />
            Mark all as read
          </Button>
        </div>
      </div>

      <Alert className="border-primary/15 bg-primary/5">
        <BellIcon className="size-4" />
        <AlertTitle>Dummy portal notifications</AlertTitle>
        <AlertDescription>
          This page is UI-only for now. The cards below use static sample data
          shaped around student billing, enrollment, and account activity.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Unread"
          value={String(unreadCount)}
          hint="Needs your attention"
          accent="primary"
        />
        <SummaryTile
          label="Action Required"
          value={String(actionRequiredCount)}
          hint="Payment or follow-up"
          accent="warning"
        />
        <SummaryTile
          label="This Week"
          value={String(thisWeekCount)}
          hint="Recent portal updates"
          accent="default"
        />
        <SummaryTile
          label="Billing Updates"
          value={String(billingCount)}
          hint="Collections and receipts"
          accent="success"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
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
                  <TabsTrigger value="announcement">Announcements</TabsTrigger>
                </TabsList>
              </div>

              {["all", "unread", "billing", "enrollment", "announcement"].map(
                (value) => (
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
                            className={cn(
                              "px-4 py-4 transition-colors hover:bg-muted/25",
                              item.unread && "bg-primary/[0.03]",
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
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      CATEGORY_STYLES[item.category].badgeClass,
                                    )}
                                  >
                                    {CATEGORY_LABELS[item.category]}
                                  </Badge>
                                  <Badge variant="outline">{item.source}</Badge>
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
                ),
              )}
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/10 bg-gradient-to-br from-primary/8 via-background to-background">
            <CardHeader>
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                Priority
              </CardDescription>
              <CardTitle className="text-lg">{spotlight.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm leading-6">
                {spotlight.message}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    CATEGORY_STYLES[spotlight.category].badgeClass,
                  )}
                >
                  {CATEGORY_LABELS[spotlight.category]}
                </Badge>
                <Badge variant="outline">{spotlight.timeLabel}</Badge>
              </div>
              <Button className="w-full" type="button">
                <CircleAlertIcon />
                {spotlight.ctaLabel ?? "Review update"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Types</CardTitle>
              <CardDescription>
                Planned message groups for the student portal inbox.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TypeRow
                icon={CreditCardIcon}
                label="Billing"
                detail="Payment verification, due reminders, receipts"
              />
              <TypeRow
                icon={BookCheckIcon}
                label="Enrollment"
                detail="Bill generation, enrolled status, term confirmation"
              />
              <TypeRow
                icon={GraduationCapIcon}
                label="Academic"
                detail="Orientation, class reminders, student milestones"
              />
              <TypeRow
                icon={MegaphoneIcon}
                label="Announcements"
                detail="School-wide notices and service updates"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview Flow</CardTitle>
              <CardDescription>
                Suggested portal behavior once live data is wired in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <FlowRow
                step="1"
                title="Student submits payment proof"
                note="A pending billing notification appears immediately."
              />
              <Separator />
              <FlowRow
                step="2"
                title="Cashier verifies the payment"
                note="The student receives a confirmed receipt update."
              />
              <Separator />
              <FlowRow
                step="3"
                title="Enrollment status changes"
                note="The portal inbox records the milestone for the term."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "default" | "primary" | "warning" | "success";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tracking-tight",
            accent === "primary" && "text-primary",
            accent === "warning" && "text-amber-700 dark:text-amber-300",
            accent === "success" && "text-emerald-700 dark:text-emerald-300",
          )}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

function NotificationAvatar({ item }: { item: PortalNotification }) {
  const Icon = CATEGORY_STYLES[item.category].icon;

  return (
    <Avatar className="mt-0.5 rounded-2xl">
      <AvatarFallback
        className={cn(
          "rounded-2xl text-xs font-semibold",
          CATEGORY_STYLES[item.category].chipClass,
        )}
      >
        <Icon className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function TypeRow({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof CreditCardIcon;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4.5" />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{detail}</p>
      </div>
    </div>
  );
}

function FlowRow({
  step,
  title,
  note,
}: {
  step: string;
  title: string;
  note: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {step}
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{note}</p>
      </div>
    </div>
  );
}

export default NotificationsPage;
