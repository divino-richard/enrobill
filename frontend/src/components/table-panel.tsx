import type { ComponentProps } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One surface for filters, records, and pagination. */
export function TablePanel({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card className={cn("min-w-0 gap-0 py-0", className)} {...props} />;
}

export function TableToolbar({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border-b p-3 [&_input]:h-9 [&_input]:text-sm [&_[data-slot=select-trigger]]:h-9 [&_[data-slot=select-trigger]]:text-sm", className)} {...props} />;
}
