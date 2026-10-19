import { Link } from 'react-router-dom';
import { ArrowRightIcon, BookOpenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SCHEDULE_DAYS, scheduleTime, type ClassEntry, type StudentSchedule } from '@/features/scheduling/types';
import { dashboardSchedule } from '../dashboard-schedule';

function ClassRow({ entry, state }: { entry: ClassEntry; state: string }) {
  return <li className="grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
    <p className="flex gap-1 text-sm tabular-nums sm:flex-col">
      <span className="font-medium">{scheduleTime(entry.startTime)}</span>
      <span className="text-muted-foreground"><span className="sm:hidden">– </span>{scheduleTime(entry.endTime)}</span>
    </p>
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold wrap-anywhere">{entry.subject}</h3>
        <span className={`text-sm ${state === 'In progress' || state === 'Up next' ? 'font-medium text-primary' : 'text-muted-foreground'}`}>{state}</span>
      </div>
      {(entry.room || entry.teacher) && <p className="text-sm text-muted-foreground wrap-anywhere">{[entry.room && `Room ${entry.room}`, entry.teacher].filter(Boolean).join(' · ')}</p>}
    </div>
  </li>;
}

export function DashboardClasses({ schedule, now }: { schedule: StudentSchedule | undefined; now: Date }) {
  const published = schedule?.status === 'published';
  const { classes, finished, next } = dashboardSchedule(published ? schedule.entries : [], now);
  return <>
    {published && classes.length > 0 ? <ol className="mt-2 divide-y" aria-label="Upcoming and current classes">
      {classes.map(entry => <ClassRow key={entry.id} entry={entry} state={entry.state} />)}
    </ol> : <div className="flex items-start gap-3 py-5">
      <BookOpenIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-2 text-sm">
        <p className="font-medium">{!published ? 'Your schedule is on its way' : finished.length ? 'Classes finished for today' : 'No classes today'}</p>
        {!published ? <p className="text-muted-foreground">Classes will appear once your section’s schedule is published.</p> : next ? <p className="text-muted-foreground wrap-anywhere">
          Next class: <span className="font-medium text-foreground">{next.entry.subject}</span><br />
          {next.daysAhead === 1 ? 'Tomorrow' : `${next.daysAhead === 7 ? 'Next ' : ''}${SCHEDULE_DAYS[next.entry.day - 1]}`} · {scheduleTime(next.entry.startTime)}{next.entry.room ? ` · Room ${next.entry.room}` : ''}
        </p> : <p className="text-muted-foreground">No classes are listed in your published schedule.</p>}
      </div>
    </div>}
    {finished.length > 0 && <details className="border-t">
      <summary className="min-h-11 cursor-pointer content-center rounded-sm text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Finished today ({finished.length})</summary>
      <ol className="divide-y" aria-label="Finished classes">{finished.map(entry => <ClassRow key={entry.id} entry={entry} state="Finished" />)}</ol>
    </details>}
  </>;
}

export function ScheduleLink() {
  return <Button asChild variant="link" className="min-h-11 px-0"><Link to="/portal/programs?section=schedule">View schedule<ArrowRightIcon aria-hidden="true" /></Link></Button>;
}
