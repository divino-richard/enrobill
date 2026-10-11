import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateContent {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** An empty section explains what belongs here and offers its next action. */
export function EmptyState({ icon: Icon, title, description, action, layout = 'centered' }: EmptyStateContent & { action?: ReactNode; layout?: 'centered' | 'inline' }) {
  if (layout === 'inline') return <div className="flex flex-wrap items-center justify-between gap-4">
    <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" strokeWidth={1.5} aria-hidden="true" /></div>
      <div className="min-w-0"><h3 className="text-sm font-medium text-foreground">{title}</h3><p className="mt-1 max-w-prose text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p></div>
    </div>
    {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
  </div>;
  return <div className="flex flex-col items-center px-2 py-6 text-center sm:py-7">
    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
    {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
  </div>;
}
