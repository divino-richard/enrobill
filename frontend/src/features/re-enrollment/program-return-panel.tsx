import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { startStudentReturn, useStudentReturn } from './api';
import { returnDate, returnTitle } from './presentation';
import { ReturnJourney } from './return-journey';

export function ProgramReturnPanel() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [params, setParams] = useSearchParams();
  const query = useStudentReturn();
  const cache = useQueryClient();
  const open = params.get('reenroll') === '1';
  const setOpen = (value: boolean) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set('reenroll', '1'); else next.delete('reenroll');
    return next;
  }, {replace: true});
  const start = useMutation({
    mutationFn: startStudentReturn,
    onSuccess: async () => {await cache.invalidateQueries({queryKey: ['me']});},
    onError: () => {void query.refetch();},
  });
  const data = query.data;
  const actionLabel = data?.canStart ? 'Review & re-enroll' : data?.state === 'pending' ? 'Continue re-enrollment' : 'View details';
  if (!open && data && (data.state === 'not_applicable' || data.state === 'enrolled')) return null;

  return <Dialog open={open} onOpenChange={setOpen}>
    <section aria-label="Re-enrollment" className="flex flex-wrap items-center justify-between gap-4 border-t px-(--card-spacing) pt-4">
      <div className="min-w-0 space-y-1">
        {query.isLoading ? <Skeleton className="h-4 w-52" /> : query.isError ? <>
          <h2 className="text-sm font-medium">Re-enrollment status unavailable</h2>
          <p className="text-xs text-muted-foreground">Open details to retry.</p>
        </> : data && <>
          <h2 className="text-sm font-medium">{returnTitle(data)}</h2>
          {data.returnDeadline && <p className="text-xs text-muted-foreground">Return deadline: {returnDate(data.returnDeadline)} · Manila time</p>}
        </>}
      </div>
      <DialogTrigger asChild><Button ref={triggerRef} variant="outline" aria-label={actionLabel === 'View details' ? 'View details for re-enrollment' : actionLabel} className="w-full sm:w-auto">{actionLabel}</Button></DialogTrigger>
    </section>
    <DialogContent
      className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 [&>[data-slot=dialog-close]]:top-2.5 [&>[data-slot=dialog-close]]:right-2.5 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center"
      onCloseAutoFocus={event => {
        const trigger = triggerRef.current;
        if (!trigger?.closest('[hidden]')) return;
        const selectedTab = trigger.closest('[data-slot="tabs"]')?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (selectedTab) {
          event.preventDefault();
          selectedTab.focus();
        }
      }}
    >
      <DialogHeader className="shrink-0 border-b p-5 pr-12 text-left">
        <DialogTitle>Re-enrollment</DialogTitle>
        <DialogDescription className="sr-only">Review your return to school and payment requirements.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto p-5">
        {query.isLoading ? <div role="status" aria-label="Loading re-enrollment"><Skeleton className="h-32" /><Skeleton className="mt-4 h-40" /></div> : query.isError || !data ? <div className="space-y-3"><p role="alert">We couldn’t load your re-enrollment details.</p><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button></div> : <ReturnJourney data={data} onStart={() => data.offer && start.mutate(data.offer.schoolYearId)} busy={start.isPending} error={start.error} />}
      </div>
    </DialogContent>
  </Dialog>;
}
