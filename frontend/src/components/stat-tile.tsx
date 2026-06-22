import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  // Tailwind text-color class for the icon chip (e.g. "text-emerald-600").
  accent?: string;
}

// A compact KPI card used across dashboards.
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-primary",
}: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p className="truncate text-2xl font-semibold tracking-tight">
            {value}
          </p>
          {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg",
              accent,
            )}
          >
            <Icon className="size-4.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
