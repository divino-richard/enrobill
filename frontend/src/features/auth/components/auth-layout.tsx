import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import campusUrl from "@/assets/northlink-campus.png";

interface AuthLayoutProps {
  // Label shown under the brand (e.g. "Enrollment & Tuition Portal").
  subtitle: string;
  children: ReactNode;
  // Width of the card (defaults to a comfortable login width).
  contentClassName?: string;
}

// Shared auth screen: a single card with the logo section and form section
// aligned horizontally (stacked on small screens).
export function AuthLayout({
  subtitle,
  children,
  contentClassName,
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-4 overflow-hidden bg-linear-to-b from-primary/5 via-background to-background p-4">
      {/* Dotted texture across the whole page. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] bg-size-[22px_22px]" />
      {/* Soft brand-orange glow up top to echo the logo's accent. */}
      <div className="bg-brand-accent/20 pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl" />

      <Card
        className={cn(
          "relative z-10 grid w-full gap-0 overflow-hidden p-0 shadow-lg md:grid-cols-2",
          contentClassName ?? "max-w-3xl",
        )}
      >
        {/* Logo section — campus photo behind a transparent brand cover. */}
        <div
          className="relative flex flex-col items-center justify-center gap-4 bg-brand bg-cover bg-center p-8 text-center"
          style={{ backgroundImage: `url(${campusUrl})` }}
        >
          <div className="from-brand/90 to-brand/70 absolute inset-0 bg-linear-to-br" />
          <div className="relative z-10 flex flex-col items-center gap-3 text-white">
            <div className="ring-border rounded-full bg-white p-1.5 shadow-sm ring-1">
              <Logo className="size-20 rounded-full" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">Enrobill</h1>
              <p className="text-sm font-medium text-white/90">
                Northlink Technological College
              </p>
              <p className="text-sm text-white/70">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Form section. */}
        <div className="flex flex-col justify-center p-6 sm:p-8">
          {children}
        </div>
      </Card>

      <p className="text-muted-foreground relative z-10 text-xs">
        © {new Date().getFullYear()} Northlink Technological College
      </p>
    </div>
  );
}
