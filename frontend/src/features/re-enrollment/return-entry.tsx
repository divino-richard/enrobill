import { Link } from 'react-router-dom';
import { ArrowRightIcon, CircleCheckIcon, ClockIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentReturn } from './api';
import { returnActionLabel, returnDate, returnDescription, returnNeedsEligibilityReview, returnTitle, STUDENT_RETURN_PATH } from './presentation';
import { cn } from '@/lib/utils';

export function ReturnEntry() {
  const query = useStudentReturn();
  if (query.isLoading) return <Skeleton aria-label="Loading re-enrollment status" className="h-20 rounded-xl" />;
  if (query.isError) return <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3"><p className="text-sm" role="alert">Re-enrollment status couldn’t be loaded.</p><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button></section>;
  const data = query.data;
  if (!data || data.state === 'not_applicable' || data.state === 'enrolled') return null;
  const needsReview = returnNeedsEligibilityReview(data);
  const actionLabel = returnActionLabel(data);
  const ready = data.canStart && !needsReview;
  const waiting = data.state === 'pending' && !needsReview;
  const Icon = ready ? CircleCheckIcon : needsReview || data.state === 'settlement_required' ? TriangleAlertIcon : ClockIcon;
  return <section aria-label="Re-enrollment" className={cn('flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-3',
    ready ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
      : waiting ? 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100'
        : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100')}>
    <Icon className="size-5 shrink-0 sm:self-start" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-0.5">
      <h2 className="text-base font-semibold leading-5">{returnTitle(data)}</h2>
      <p className="max-w-prose text-sm leading-5 opacity-85">{data.state === 'unavailable' && !needsReview ? 'Wait for a later school year to open. No payment is required now.' : returnDescription(data)}</p>
      {data.returnDeadline && <p className="text-xs">{needsReview ? 'Return deadline:' : 'Complete re-enrollment by'} <span className="font-semibold">{returnDate(data.returnDeadline)}</span></p>}
    </div>
    {actionLabel && <Button asChild variant="outline" className="min-h-10 w-full shrink-0 border-current/20 bg-card/80 text-foreground shadow-none sm:w-auto"><Link to={STUDENT_RETURN_PATH}>{actionLabel}<ArrowRightIcon aria-hidden="true" /></Link></Button>}
  </section>;
}
