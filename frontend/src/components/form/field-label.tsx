import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HelpHint } from "./help-hint";

interface FieldLabelProps {
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  // Help text shown via a hover/focus question-mark icon.
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

// Label with a clear required (*) / optional indicator and an optional help
// hint, so applicants can see at a glance what they must fill in and why.
export function FieldLabel({
  htmlFor,
  required,
  optional,
  hint,
  className,
  children,
}: FieldLabelProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="gap-1 text-xs">
        <span>{children}</span>
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {optional && (
          <span className="text-muted-foreground text-xs font-normal">
            (optional)
          </span>
        )}
      </Label>
      {hint && <HelpHint>{hint}</HelpHint>}
    </div>
  );
}
