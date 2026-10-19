import { SCHEDULE_DAYS, type ClassEntry } from '@/features/scheduling/types';

function minutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function schoolMoment(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value;
  return {
    day: SCHEDULE_DAYS.indexOf(value('weekday')) + 1,
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
    label: new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).format(now),
  };
}

export function dashboardSchedule(entries: ClassEntry[], now: Date) {
  const moment = schoolMoment(now);
  const today = entries.filter(entry => entry.day === moment.day).sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
  const finished = today.filter(entry => minutes(entry.endTime) <= moment.minutes);
  const remaining = today.filter(entry => minutes(entry.endTime) > moment.minutes);
  const firstUpcoming = remaining.find(entry => minutes(entry.startTime) > moment.minutes);
  const classes = remaining.map(entry => ({
    ...entry,
    state: minutes(entry.startTime) <= moment.minutes ? 'In progress' : entry === firstUpcoming ? 'Up next' : 'Later today',
  }));
  const next = entries.map(entry => {
    const daysAhead = (entry.day - moment.day + 7) % 7;
    return { entry, daysAhead: daysAhead === 0 && minutes(entry.startTime) <= moment.minutes ? 7 : daysAhead };
  }).sort((a, b) => a.daysAhead - b.daysAhead || minutes(a.entry.startTime) - minutes(b.entry.startTime))[0];

  return { classes, finished, next };
}
