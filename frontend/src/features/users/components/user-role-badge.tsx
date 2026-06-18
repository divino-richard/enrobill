import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { USER_ROLE_META, type UserRole } from "../types";

interface UserRoleBadgeProps {
  role: UserRole;
  className?: string;
}

export function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const meta = USER_ROLE_META[role];

  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
