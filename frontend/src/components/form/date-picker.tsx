import type { ComponentProps } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  id?: string
  // 'yyyy-MM-dd' (empty string when unset).
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  // Dropdown range + which dates are selectable. Defaults to past dates only
  // (suits dates of birth); pass these to allow current/future dates.
  startMonth?: Date
  endMonth?: Date
  disabledDates?: ComponentProps<typeof Calendar>['disabled']
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

// Reusable date picker (Popover + Calendar). Defaults to past dates only, which
// suits dates of birth; the year/month dropdowns make old dates easy to reach.
export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder = 'Select date',
  disabled,
  startMonth,
  endMonth,
  disabledDates,
}: DatePickerProps) {
  const selected = parseDate(value)
  const today = new Date()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          onBlur={onBlur}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="size-4" />
          {selected ? format(selected, 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={startMonth ?? new Date(1950, 0)}
          endMonth={endMonth ?? today}
          disabled={disabledDates ?? { after: today }}
          onSelect={(date) =>
            onChange(date ? format(date, 'yyyy-MM-dd') : '')
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
