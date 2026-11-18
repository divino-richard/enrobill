import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES } from "../password";

interface PasswordRequirementsProps {
  value: string;
}

// Live checklist that guides the user toward a strong password.
export function PasswordRequirements({ value }: PasswordRequirementsProps) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              met
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground",
            )}
          >
            {met ? (
              <Check aria-hidden="true" className="size-3.5 shrink-0" />
            ) : (
              <Circle aria-hidden="true" className="size-3 shrink-0" />
            )}
            <span className="text-xs">{rule.label}</span>
            <span className="sr-only">{met ? " — met" : " — not met"}</span>
          </li>
        );
      })}
    </ul>
  );
}
