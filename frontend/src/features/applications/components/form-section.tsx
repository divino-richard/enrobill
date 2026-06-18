import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
  icon: Icon,
  children,
}: FormSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        {Icon && <Icon className="text-primary size-4 shrink-0" />}
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
      </div>
      {description && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
      {children}
    </section>
  );
}
