import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "../password";

interface PasswordRequirementsProps {
  value: string;
}

// Live checklist that guides the user toward a strong password.
export function PasswordRequirements({ value }: PasswordRequirementsProps) {
  return (
    <ul className="space-y-1 flex gap-2" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              met
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-muted-foreground",
            )}
          >
            {met ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <Circle className="size-3 shrink-0" />
            )}
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
