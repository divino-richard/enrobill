import type { Term } from '@/features/terms/types';
import { PERIODS, type DroppingPolicy, type PeriodKey } from './api';

export const CATEGORIES = [{ key: 'paying', label: 'Paying' }, { key: 'voucher_esc', label: 'With voucher' }] as const;

export function periodDateProblems(key: PeriodKey, periods: Partial<DroppingPolicy['periods']>, term: Term): string[] {
  const range = periods[key];
  if (!range?.startsOn || !range.endsOn) return ['Choose a start and end date.'];
  if (range.endsOn < range.startsOn) return ['The end date must be on or after the start date.'];
  const index = PERIODS.findIndex(period => period.key === key);
  for (let i = 0; i < PERIODS.length; i++) {
    if (i === index) continue;
    const other = periods[PERIODS[i].key];
    if (i < index && other?.endsOn && range.startsOn <= other.endsOn) return [`Start after ${PERIODS[i].label.toLowerCase()} ends.`];
    if (i > index && other?.startsOn && range.endsOn >= other.startsOn) return [`End before ${PERIODS[i].label.toLowerCase()} starts.`];
  }
  if (key === 'enrollment' && term.startDate && range.startsOn > term.startDate) return ['Enrollment must begin on or before the school year starts.'];
  if (key === 'quarter_4' && term.endDate && range.endsOn < term.endDate) return ['The final quarter must cover the school year’s end date.'];
  return [];
}

export function expectedPeriodStart(key: PeriodKey, periods: Partial<DroppingPolicy['periods']>): string | null {
  const index = PERIODS.findIndex(period => period.key === key);
  const previousEnd = index > 0 ? periods[PERIODS[index - 1].key]?.endsOn : null;
  if (!previousEnd) return null;
  const date = new Date(`${previousEnd}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
