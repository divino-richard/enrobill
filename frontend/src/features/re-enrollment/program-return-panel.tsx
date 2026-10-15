import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { startStudentReturn, useStudentReturn } from './api';
import { returnActionLabel, returnDate, returnTitle } from './presentation';
import { ReturnJourney } from './return-journey';
import { ReturnSubmitted } from './return-submitted';
import { cn } from '@/lib/utils';

export function ProgramReturnPanel() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const startLock = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [params, setParams] = useSearchParams();
  const query = useStudentReturn();
  const cache = useQueryClient();
  const requestedOpen = params.get('reenroll') === '1';
  const setOpen = (value: boolean) => {
    if (startLock.current) return;
    setSubmitted(false);
    if (value) start.reset();
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set('reenroll', '1'); else next.delete('reenroll');
      return next;
    }, {replace: true});
  };
  const start = useMutation({
    mutationFn: startStudentReturn,
    onSuccess: () => {
      setSubmitted(true);
      void cache.invalidateQueries({queryKey: ['me']});
    },
    onError: () => {void query.refetch();},
    onSettled: () => {startLock.current = false;},
  });
  const data = query.data;
  const actionLabel = data ? returnActionLabel(data) : 'View details';
  const hasAction = actionLabel !== null && !start.isSuccess;
  const open = requestedOpen && (submitted || hasAction);
  useEffect(() => { if (open && submitted) titleRef.current?.focus(); }, [open, submitted]);
  useEffect(() => {
    if (!requestedOpen || submitted || hasAction || start.isPending) return;
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('reenroll');
      return next;
    }, {replace: true});
  }, [requestedOpen, submitted, hasAction, start.isPending, setParams]);
  const beginReturn = () => {
    if (!data?.canStart || !data.offer || startLock.current || start.isSuccess) return;
    startLock.current = true;
    start.mutate(data.offer.schoolYearId);
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    {hasAction && <section aria-label="Re-enrollment" className="flex flex-wrap items-center justify-between gap-4 border-t px-(--card-spacing) pt-4">
      <div className="min-w-0 space-y-1">
        {query.isLoading ? <Skeleton className="h-4 w-52" /> : query.isError ? <>
          <h2 className="text-sm font-medium">Re-enrollment status unavailable</h2>
          <p className="text-xs text-muted-foreground">Open details to retry.</p>
        </> : data && <>
          <h2 className="text-sm font-medium">{returnTitle(data)}</h2>
          {data.returnDeadline && <p className="text-xs text-muted-foreground">Return deadline: {returnDate(data.returnDeadline)}</p>}
        </>}
      </div>
      <DialogTrigger asChild><Button ref={triggerRef} variant="outline" aria-label={actionLabel === 'View details' ? 'View details for re-enrollment' : actionLabel ?? undefined} className="w-full sm:w-auto">{actionLabel}</Button></DialogTrigger>
    </section>}
    <DialogContent
      showCloseButton={false}
      className={cn('flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0', submitted ? 'max-w-md' : 'max-w-xl')}
      onEscapeKeyDown={event => { if (startLock.current) event.preventDefault(); }}
      onInteractOutside={event => { if (startLock.current) event.preventDefault(); }}
      onCloseAutoFocus={event => {
        const trigger = triggerRef.current;
        if (trigger?.isConnected && !trigger.closest('[hidden]')) return;
        const selectedTab = trigger?.closest('[data-slot="tabs"]')?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
          ?? document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (selectedTab) {
          event.preventDefault();
          selectedTab.focus();
        }
      }}
    >
      <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 size-8" disabled={start.isPending} aria-label="Close re-enrollment dialog" onClick={() => setOpen(false)}><XIcon aria-hidden="true" /></Button>
      {submitted ? <div className="min-h-0 overflow-y-auto"><ReturnSubmitted titleRef={titleRef} onDone={() => setOpen(false)} /></div> : <>
        <DialogHeader className="shrink-0 border-b p-5 pr-12 text-left">
          <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">Re-enrollment</DialogTitle>
          <DialogDescription className="sr-only">Review your return to school.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto p-5">
          {query.isLoading ? <div role="status" aria-label="Loading re-enrollment"><Skeleton className="h-32" /><Skeleton className="mt-4 h-40" /></div> : query.isError || !data ? <div className="space-y-3"><p role="alert">We couldn’t load your re-enrollment details.</p><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button></div> : <ReturnJourney data={data} onStart={beginReturn} busy={start.isPending} error={start.error} />}
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
