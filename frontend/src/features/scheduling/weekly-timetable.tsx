import { useId, useState, type ReactNode } from "react";
import { Clock3Icon, MapPinIcon, PencilIcon, PlusIcon, Trash2Icon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SCHEDULE_DAYS, classMinutes, scheduleDuration, scheduleTime, type ClassEntry } from "./types";

type WeeklyTimetableProps = {
  className?: string;
  entries: ClassEntry[];
  onEdit?: (entry: ClassEntry) => void;
  onRemove?: (entry: ClassEntry) => void;
  onAdd?: (day: number) => void;
  disabled?: boolean;
  summary?: ReactNode;
};

export function WeeklyTimetable({ entries, onEdit, onAdd, onRemove, disabled, summary, className }: WeeklyTimetableProps) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [weekend, setWeekend] = useState(false);
  const id = useId();
  const days = SCHEDULE_DAYS.filter((_, index) => index < 5 || weekend || entries.some((entry) => entry.day === index + 1));
  const activeDay = days.some((day) => SCHEDULE_DAYS.indexOf(day) + 1 === selectedDay) ? selectedDay : 1;

  return (
    <div className={cn("bg-card min-w-0 space-y-3 rounded-xl border p-3", className)}>
      {(summary || onAdd) && <div className="flex flex-wrap items-center justify-between gap-2">
        {summary}
        {onAdd && <Button type="button" variant="ghost" size="sm" aria-pressed={weekend} onClick={() => setWeekend(!weekend)}>
          {weekend ? "Hide empty weekends" : "Show weekends"}
        </Button>}
      </div>}
      <div role="group" aria-label="Choose a day" className="bg-muted/50 flex gap-1 rounded-lg p-1 md:hidden">
        {days.map((day) => {
          const number = SCHEDULE_DAYS.indexOf(day) + 1;
          const count = entries.filter((entry) => entry.day === number).length;
          return <button key={day} type="button" aria-label={`${day}, ${count} ${count === 1 ? "class" : "classes"}`} aria-pressed={activeDay === number} aria-controls={`${id}-${number}`} onClick={() => setSelectedDay(number)}
            className={cn("focus-visible:ring-ring min-h-11 min-w-0 flex-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2", activeDay === number ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {day.slice(0, 3)}
          </button>;
        })}
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl border">
        <div className="md:flex">
          {days.map((day) => {
            const number = SCHEDULE_DAYS.indexOf(day) + 1;
            const classes = entries.filter((entry) => entry.day === number).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const duration = classes.reduce((total, entry) => total + classMinutes(entry), 0);
            return <section key={day} id={`${id}-${number}`} aria-label={day} className={cn("min-w-0 md:block md:min-w-48 md:flex-1 md:border-r md:last:border-r-0", activeDay !== number && "hidden")}>
              <div className="bg-muted/40 flex items-center justify-between gap-2 border-b px-3 py-3">
                <div>
                  <h3 className="text-sm font-semibold">{day}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">{classes.length} {classes.length === 1 ? "class" : "classes"}{duration > 0 ? ` · ${scheduleDuration(duration)}` : ""}</p>
                </div>
                {onAdd && <Button type="button" size="icon-sm" variant="ghost" disabled={disabled} aria-label={`Add class on ${day}`} onClick={() => onAdd(number)}><PlusIcon aria-hidden="true" /></Button>}
              </div>
              <div className="space-y-3 p-3 md:min-h-64">
                {classes.length === 0 && <div className="py-8 text-center">
                  <p className="text-muted-foreground text-sm">No classes yet</p>
                  {onAdd && <Button type="button" variant="link" size="sm" disabled={disabled} onClick={() => onAdd(number)}>Add a class</Button>}
                </div>}
                {classes.map((entry) => {
                  const content = <>
                    <span className="text-primary flex items-center gap-1.5 text-xs font-medium tabular-nums"><Clock3Icon aria-hidden="true" className="size-3.5 shrink-0" />{scheduleTime(entry.startTime)} – {scheduleTime(entry.endTime)}</span>
                    <span className="my-3 flex items-start justify-between gap-2"><span className="min-w-0 break-words font-semibold leading-snug">{entry.subject}</span>{onEdit && <PencilIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />}</span>
                    <span className="text-muted-foreground flex items-start gap-1.5 text-xs"><UserIcon aria-hidden="true" className="size-3.5 shrink-0" /><span className="min-w-0 break-words">{entry.teacher}</span></span>
                    <span className="text-muted-foreground mt-1.5 mr-6 flex items-start gap-1.5 text-xs"><MapPinIcon aria-hidden="true" className="size-3.5 shrink-0" /><span className="min-w-0 break-words">{entry.room}</span></span>
                  </>;
                  const className = "bg-background block w-full rounded-lg border p-3 text-left text-sm";
                  return onEdit
                    ? <div key={entry.id} className="relative"><button type="button" disabled={disabled} onClick={() => onEdit(entry)} aria-label={`Edit ${entry.subject}, ${day}, ${scheduleTime(entry.startTime)}`} className={cn(className, "hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-ring transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60")}>{content}</button>{onRemove && <Button type="button" variant="ghost" size="icon-sm" className="absolute bottom-1 right-1 text-muted-foreground hover:text-destructive" disabled={disabled} aria-label={`Remove ${entry.subject}, ${day}, ${scheduleTime(entry.startTime)}`} onClick={() => onRemove(entry)}><Trash2Icon className="size-3.5" /></Button>}</div>
                    : <div key={entry.id} className={className}>{content}</div>;
                })}
              </div>
            </section>;
          })}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">Local school time.{onEdit ? " Select a class to edit." : ""}</p>
    </div>
  );
}
