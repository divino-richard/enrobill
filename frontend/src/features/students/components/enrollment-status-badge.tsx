import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ENROLLMENT_STATUS_META, type EnrollmentStatus } from "../types";

interface EnrollmentStatusBadgeProps {
  status: EnrollmentStatus;
  className?: string;
}

export function EnrollmentStatusBadge({
  status,
  className,
}: EnrollmentStatusBadgeProps) {
  const meta = ENROLLMENT_STATUS_META[status];

  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
