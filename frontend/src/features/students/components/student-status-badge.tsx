import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STUDENT_STATUS_META, type StudentStatus } from "../types";

interface StudentStatusBadgeProps {
  status: StudentStatus;
  className?: string;
}

export function StudentStatusBadge({
  status,
  className,
}: StudentStatusBadgeProps) {
  const meta = STUDENT_STATUS_META[status];

  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
