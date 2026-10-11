import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon, PlusIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTerms } from '@/features/terms/hooks';
import { NewTermDialog } from '@/features/terms/term-forms';
import { formatDate } from '@/features/applications/utils';
import { formatPeso } from '@/lib/money';

export default function TermsPage() {
  const { data: terms = [], isPending, isError, isFetching, refetch } = useTerms();
  const [creating, setCreating] = useState(false);
  const active = terms.find(term => term.isActive);

  return <div className="mx-auto max-w-6xl space-y-6 [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3]">
    <div className="flex flex-wrap items-center justify-between gap-4"><PageHeader title="Academic Years" /><Button className="h-10" onClick={() => setCreating(true)}><PlusIcon aria-hidden="true" />New school year</Button></div>
    {isPending ? <div role="status" className="space-y-3"><span className="sr-only">Loading academic years…</span><Skeleton className="h-16 w-full" /><Skeleton className="h-40 w-full" /></div>
      : isError ? <section role="alert" className="space-y-3 rounded-xl border bg-card p-6"><p className="text-sm">Unable to load academic years.</p><Button variant="outline" disabled={isFetching} onClick={() => refetch()}>Try again</Button></section>
      : <>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          {active ? <p className="text-muted-foreground">Current year <Link className="ml-2 rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" to={`/admin/terms/${active.id}`}>SY {active.schoolYear}</Link><span className="mx-2" aria-hidden="true">·</span>Admissions {active.admissionOpen ? 'open' : 'closed'}</p> : <p className="text-muted-foreground">No active school year. Open a year to activate it.</p>}
          <span className="text-xs text-muted-foreground">{terms.length} school {terms.length === 1 ? 'year' : 'years'}</span>
        </div>
        {terms.length === 0 ? <section className="space-y-2 rounded-xl border bg-card px-6 py-12 text-center"><h2 className="font-semibold">Create your first academic year</h2><p className="text-sm text-muted-foreground">Set its dates and payment plan to get started.</p></section> : <div className="overflow-hidden rounded-xl border bg-card">
          <Table aria-label="Academic years">
            <TableHeader><TableRow><TableHead className="pl-5">School year</TableHead><TableHead>Period</TableHead><TableHead>Payment plan</TableHead><TableHead>Status</TableHead><TableHead className="text-right pr-5"><span className="sr-only">Details</span></TableHead></TableRow></TableHeader>
            <TableBody>{terms.map(term => <TableRow key={term.id} className="group relative cursor-pointer focus-within:bg-muted/50">
              <TableCell className="pl-5 font-semibold">{term.schoolYear}</TableCell>
              <TableCell className="text-muted-foreground">{term.startDate && term.endDate ? `${formatDate(term.startDate)} – ${formatDate(term.endDate)}` : 'Dates not set'}</TableCell>
              <TableCell className="text-muted-foreground">{term.downpaymentType === 'percentage' ? `${term.downpaymentValue}%` : formatPeso(term.downpaymentValue)} down · {term.installmentCount} monthly</TableCell>
              <TableCell><Badge variant="secondary" className={term.isActive ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : ''}>{term.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
              <TableCell className="w-16 pr-5 text-right">
                {/* Stretch the native link over the row, preserving keyboard and new-tab behavior. */}
                <Link to={`/admin/terms/${term.id}`} aria-label={`View details for SY ${term.schoolYear}`} title={`View SY ${term.schoolYear}`} className="inline-flex size-11 items-center justify-center text-muted-foreground after:absolute after:inset-0 after:content-[''] group-hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring">
                  <ChevronRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>}
      </>}
    <NewTermDialog open={creating} onOpenChange={setCreating} />
  </div>;
}
