import type { ReactNode } from 'react'
import { HelpCircleIcon } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HelpHintProps {
  children: ReactNode
  label?: string
}

// A small question-mark icon that reveals helper text on hover/focus.
export function HelpHint({ children, label = 'More information' }: HelpHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help"
          onClick={(e) => e.preventDefault()}
        >
          <HelpCircleIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
