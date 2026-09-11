import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  title = "Dashboard",
  description,
  context,
  actions,
}: {
  title?: string;
  description: string;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">
            {title}
          </h1>
          {context}
        </div>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export type DashboardAttentionItem = {
  label: string;
  detail: string;
  value: string | number;
  onAction?: () => void;
  tone?: "primary" | "warning" | "danger";
};

export function DashboardAttention({
  label = "Needs attention",
  summary,
  items,
}: {
  label?: string;
  summary: string;
  items: DashboardAttentionItem[];
}) {
  const visibleItems = items.slice(0, 3);

  return (
    <Card className="grid gap-0 py-0 lg:grid-cols-[8.75rem_repeat(3,minmax(0,1fr))]">
      <div className="bg-primary px-4 py-3 text-primary-foreground">
        <span className="block text-[0.6875rem] font-medium tracking-[0.08em] uppercase opacity-75">
          {label}
        </span>
        <strong className="mt-1 block text-sm font-semibold">{summary}</strong>
      </div>
      {visibleItems.length ? (
        visibleItems.map((item) => {
          const content = (
            <>
              <span
                className={cn(
                  "bg-primary/10 text-primary inline-flex size-7 shrink-0 items-center justify-center rounded font-semibold tabular-nums",
                  item.tone === "warning" &&
                    "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  item.tone === "danger" &&
                    "bg-destructive/10 text-destructive",
                )}
              >
                {item.value}
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-xs font-semibold">
                  {item.label}
                </span>
                <span className="text-muted-foreground mt-0.5 block truncate text-[0.6875rem]">
                  {item.detail}
                </span>
              </span>
              {item.onAction ? (
                <ArrowRightIcon className="text-primary size-4 shrink-0" />
              ) : null}
            </>
          );

          return item.onAction ? (
            <button
              key={item.label}
              type="button"
              className="hover:bg-muted/50 focus-visible:ring-ring grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:border-t-0 lg:border-l"
              onClick={item.onAction}
            >
              {content}
            </button>
          ) : (
            <div
              key={item.label}
              className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t px-3 py-2.5 lg:border-t-0 lg:border-l"
            >
              {content}
            </div>
          );
        })
      ) : (
        <div className="text-muted-foreground flex min-h-16 items-center px-4 text-xs lg:col-span-3 lg:border-l">
          Nothing requires immediate action.
        </div>
      )}
      {visibleItems.length > 0
        ? Array.from({ length: Math.max(0, 3 - visibleItems.length) }).map(
            (_, index) => (
              <div
                key={`empty-${index}`}
                className="hidden border-l lg:block"
                aria-hidden="true"
              />
            ),
          )
        : null}
    </Card>
  );
}

export type DashboardMetric = {
  label: string;
  value: ReactNode;
  detail: string;
  trend?: number[];
  tone?: "primary" | "success" | "warning" | "danger";
};

const detailTone = {
  primary: "text-primary",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-destructive",
};

export function DashboardMetricStrip({
  metrics,
}: {
  metrics: DashboardMetric[];
}) {
  return (
    <Card className="grid gap-0 py-0 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="border-b p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground truncate text-xs font-medium">
              {metric.label}
            </p>
            {metric.trend?.length ? (
              <MetricTrend values={metric.trend} tone={metric.tone} />
            ) : null}
          </div>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-[-0.025em] tabular-nums">
            {metric.value}
          </p>
          <p
            className={cn(
              "mt-1 truncate text-xs",
              detailTone[metric.tone ?? "primary"],
            )}
          >
            {metric.detail}
          </p>
        </div>
      ))}
    </Card>
  );
}

function MetricTrend({
  values,
  tone = "primary",
}: {
  values: number[];
  tone?: DashboardMetric["tone"];
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(values.length - 1, 1)) * 34},${13 - ((value - min) / range) * 11}`,
    )
    .join(" ");

  return (
    <svg
      viewBox="0 0 34 15"
      className={cn(
        "text-primary h-4 w-9 shrink-0",
        tone === "warning" && "text-amber-600",
        tone === "danger" && "text-destructive",
        tone === "success" && "text-emerald-600",
      )}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 gap-0 py-0", className)}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : description ? (
          <p className="text-muted-foreground shrink-0 text-right text-[0.6875rem] font-medium tracking-wide uppercase">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </Card>
  );
}

export type DashboardQueueItem = {
  label: string;
  detail: string;
  value?: string | number;
  actionLabel: string;
  onAction: () => void;
  tone?: "default" | "warning" | "danger";
};

export function DashboardQueue({ items }: { items: DashboardQueueItem[] }) {
  if (items.length === 0)
    return (
      <p className="text-muted-foreground px-4 py-10 text-center text-sm">
        Nothing needs attention right now.
      </p>
    );

  return (
    <div className="px-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b py-3 last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {item.label}
              {item.value !== undefined ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {item.value}
                </span>
              ) : null}
            </p>
            <p className="text-muted-foreground mt-1 truncate text-[0.6875rem]">
              {item.detail}
            </p>
          </div>
          <button
            type="button"
            className={cn(
              "text-primary focus-visible:ring-ring inline-flex items-center gap-1 text-xs font-semibold hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:outline-none",
              item.tone === "warning" && "text-amber-700 dark:text-amber-300",
              item.tone === "danger" && "text-destructive",
            )}
            onClick={item.onAction}
          >
            {item.actionLabel}
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function DashboardLoading() {
  return (
    <div className="space-y-3" aria-label="Loading dashboard">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export function DashboardError({ retry }: { retry: () => void }) {
  return (
    <div className="space-y-4">
      <DashboardHeader description="Your dashboard could not be loaded." />
      <Card className="items-center gap-3 border border-dashed py-16 text-center shadow-none">
        <p className="text-muted-foreground text-sm">
          Check your connection and try again.
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </Card>
    </div>
  );
}
