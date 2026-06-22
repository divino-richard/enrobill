import { useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  BanknoteIcon,
  CircleFadingArrowUp,
  ClipboardListIcon,
  ClockIcon,
  GraduationCapIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  TagIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatTile } from "@/components/stat-tile";
import { formatPeso } from "@/lib/money";
import { semesterLabel } from "@/features/terms/types";
import { useAuthStore } from "@/features/auth/store";
import { useStaffDashboard } from "@/features/dashboard/hooks";

interface QuickLink {
  label: string;
  description: string;
  icon: LucideIcon;
  to: string;
}

const ADMIN_LINKS: QuickLink[] = [
  {
    label: "Applications",
    description: "Review and decide admissions",
    icon: ClipboardListIcon,
    to: "/admin/applications",
  },
  {
    label: "Students",
    description: "Manage student records",
    icon: GraduationCapIcon,
    to: "/admin/students",
  },
  {
    label: "Billing",
    description: "Generate bills and verify payments",
    icon: BanknoteIcon,
    to: "/admin/billing",
  },
  {
    label: "Progression",
    description: "Promote, retain or graduate",
    icon: CircleFadingArrowUp,
    to: "/admin/progression",
  },
];

const CASHIER_LINKS: QuickLink[] = [
  {
    label: "Billing",
    description: "Bills and payment verification",
    icon: BanknoteIcon,
    to: "/admin/billing",
  },
  {
    label: "Fee Structures",
    description: "Per-program fee items",
    icon: ReceiptTextIcon,
    to: "/admin/fees",
  },
  {
    label: "Discounts",
    description: "Scholarships and vouchers",
    icon: TagIcon,
    to: "/admin/discounts",
  },
  {
    label: "Payment Methods",
    description: "GCash / Maya QR codes",
    icon: QrCodeIcon,
    to: "/admin/payment-methods",
  },
];

function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch } = useStaffDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load the dashboard. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = data.role === "admin";
  const { finance, enrollment, openTerm } = data;
  const links = isAdmin ? ADMIN_LINKS : CASHIER_LINKS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? "Here's what's happening across enrollment and finance."
              : "Here's the collection status for the open term."}
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {openTerm
            ? `${semesterLabel(openTerm.semester)} · SY ${openTerm.schoolYear}`
            : "No open term"}
        </Badge>
      </div>

      {finance.pendingPayments > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlertIcon className="size-4 shrink-0" />
          <AlertTitle>
            {finance.pendingPayments} payment
            {finance.pendingPayments === 1 ? "" : "s"} awaiting verification
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Students have submitted payments that need your review.{" "}
            <button
              type="button"
              className="font-medium underline underline-offset-2"
              onClick={() => navigate("/admin/billing")}
            >
              Go to Billing
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && enrollment && (
          <>
            <StatTile
              label="Students"
              value={enrollment.students.total}
              hint={`${enrollment.students.enrolled} enrolled · ${enrollment.students.admitted} admitted`}
              icon={GraduationCapIcon}
            />
            <StatTile
              label="Pending applications"
              value={enrollment.applications.pending}
              hint={`${enrollment.applications.total} total`}
              icon={ClipboardListIcon}
              accent="text-blue-600 dark:text-blue-400"
            />
          </>
        )}
        <StatTile
          label="Collected"
          value={formatPeso(finance.collected)}
          hint={`${finance.collectionRate}% of billed`}
          icon={WalletIcon}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatTile
          label="Outstanding"
          value={formatPeso(finance.outstanding)}
          hint={`${formatPeso(finance.billed)} billed`}
          icon={BanknoteIcon}
          accent="text-amber-600 dark:text-amber-400"
        />
        <StatTile
          label="Pending payments"
          value={finance.pendingPayments}
          hint="Awaiting verification"
          icon={ClockIcon}
          accent="text-violet-600 dark:text-violet-400"
        />
        {!isAdmin && (
          <StatTile
            label="Collection rate"
            value={`${finance.collectionRate}%`}
            hint="Collected vs billed"
            icon={TrendingUpIcon}
            accent="text-emerald-600 dark:text-emerald-400"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bills breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bills this term</CardTitle>
            <CardDescription>
              {openTerm
                ? `${finance.bills.total} ${finance.bills.total === 1 ? "bill" : "bills"} generated`
                : "Open a term to start billing."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BillBar bills={finance.bills} />
            <dl className="grid grid-cols-3 gap-3 text-center">
              <BillStat label="Unpaid" value={finance.bills.unpaid} />
              <BillStat label="Partial" value={finance.bills.partial} />
              <BillStat label="Paid" value={finance.bills.paid} />
            </dl>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Jump to your common tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {links.map((link) => (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => navigate(link.to)}
                  className="hover:border-primary hover:bg-muted/40 group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
                >
                  <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <link.icon className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-medium">
                      {link.label}
                      <ArrowRightIcon className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {link.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BillBar({
  bills,
}: {
  bills: { total: number; unpaid: number; partial: number; paid: number };
}) {
  const total = bills.total || 1;
  const segments = [
    { value: bills.paid, className: "bg-emerald-500" },
    { value: bills.partial, className: "bg-amber-500" },
    { value: bills.unpaid, className: "bg-muted-foreground/30" },
  ];
  return (
    <div className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full">
      {segments.map((s, i) => (
        <div
          key={i}
          className={s.className}
          style={{ width: `${(s.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function BillStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default DashboardPage;
