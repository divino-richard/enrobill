import { cva } from "class-variance-authority";

// Shared surface for page notices, status messages, and inline alerts.
export const bannerStyles = cva(
  "rounded-xl border px-5 py-4 text-sm [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        info: "border-primary/20 bg-primary/10 text-primary",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
        warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
        danger: "border-destructive/30 bg-destructive/5 text-destructive",
      },
    },
    defaultVariants: { tone: "info" },
  },
);
