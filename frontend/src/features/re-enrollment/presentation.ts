import type { StudentReturnSummary } from './api';

export const STUDENT_RETURN_PATH = '/portal/programs?reenroll=1';

export const returnDate = (date: string) => new Intl.DateTimeFormat('en-PH', {month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Manila'}).format(new Date(`${date}T00:00:00+08:00`));
export function returnTitle(data: StudentReturnSummary) {
  return {ready:'Ready to return to school?',unavailable:'Re-enrollment is not yet open',pending:'Your re-enrollment is in progress',blocked:'Re-enrollment needs attention',enrolled:'You’re enrolled again',not_applicable:'Re-enrollment'}[data.state];
}
