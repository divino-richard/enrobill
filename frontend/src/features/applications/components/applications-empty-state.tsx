import { FileTextIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ApplicationsEmptyStateProps {
  onNewApplication?: () => void
  // No enrollment term is open, so applications can't be started.
  enrollmentClosed?: boolean
}

export function ApplicationsEmptyState({
  onNewApplication,
  enrollmentClosed = false,
}: ApplicationsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <FileTextIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">
          {enrollmentClosed ? "Enrollment is closed" : "No applications yet"}
        </h3>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {enrollmentClosed
            ? "There's no open enrollment term right now. Please check back once enrollment reopens."
            : "Start your enrollment application to apply for admission. You can track its status here once submitted."}
        </p>
      </div>
      {!enrollmentClosed && onNewApplication && (
        <Button onClick={onNewApplication}>
          <PlusIcon />
          Start application
        </Button>
      )}
    </div>
  )
}
