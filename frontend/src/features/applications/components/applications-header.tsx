import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ApplicationsHeaderProps {
  // Only one in-progress application is allowed at a time.
  hasActiveApplication: boolean
  onNewApplication?: () => void
}

export function ApplicationsHeader({
  hasActiveApplication,
  onNewApplication,
}: ApplicationsHeaderProps) {
  const newButton = (
    <Button onClick={onNewApplication} disabled={hasActiveApplication}>
      <PlusIcon />
      New application
    </Button>
  )

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground text-sm">
          Submit and track your enrollment applications.
        </p>
      </div>

      {hasActiveApplication ? (
        <Tooltip>
          {/* Wrapper span so the tooltip still fires on the disabled button. */}
          <TooltipTrigger asChild>
            <span className="inline-flex w-fit">{newButton}</span>
          </TooltipTrigger>
          <TooltipContent>
            You already have an application in progress.
          </TooltipContent>
        </Tooltip>
      ) : (
        newButton
      )}
    </div>
  )
}
