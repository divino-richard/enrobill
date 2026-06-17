import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_META, type ApplicationStatus } from '../types'

interface ApplicationStatusBadgeProps {
  status: ApplicationStatus
  className?: string
}

export function ApplicationStatusBadge({
  status,
  className,
}: ApplicationStatusBadgeProps) {
  const meta = APPLICATION_STATUS_META[status]

  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  )
}
