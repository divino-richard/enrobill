import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentReturn } from './api';
import { returnDate, returnTitle, STUDENT_RETURN_PATH } from './presentation';

export function ReturnEntry() {
  const query = useStudentReturn();
  if (query.isLoading) return <Skeleton aria-label="Loading re-enrollment status" className="h-24 rounded-xl" />;
  if (query.isError) return <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><p className="text-sm" role="alert">Re-enrollment status couldn’t be loaded.</p><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button></section>;
  const data = query.data;
  if (!data || data.state === 'not_applicable' || data.state === 'enrolled') return null;
  return <section aria-label="Re-enrollment" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 sm:p-5">
    <div className="min-w-0 space-y-1"><h2 className="font-semibold">{returnTitle(data)}</h2><p className="max-w-prose text-sm text-muted-foreground">{data.state === 'pending' ? 'Review the balances and verification needed to activate your enrollment.' : data.state === 'blocked' ? 'Review your eligibility and the next step with the school.' : data.state === 'ready' ? `Admissions are open for SY ${data.offer?.schoolYear}.` : 'Your account and records remain available. No payment or clearance is required now.'}</p>{data.returnDeadline && <p className="text-xs text-muted-foreground">{data.state === 'blocked' ? 'Return deadline:' : 'Complete re-enrollment by'} <span className="font-medium text-foreground">{returnDate(data.returnDeadline)}</span> · Manila time</p>}</div>
    <Button asChild variant={data.canStart || data.state === 'pending' ? 'default' : 'outline'} className="w-full sm:w-auto"><Link to={STUDENT_RETURN_PATH}>{data.canStart ? 'Re-enroll' : data.state === 'pending' ? 'Continue re-enrollment' : 'View re-enrollment'}<ArrowRightIcon aria-hidden="true" /></Link></Button>
  </section>;
}
