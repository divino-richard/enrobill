import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, ArrowUpRightIcon, ChevronRightIcon, CircleCheckIcon, Clock3Icon, FileMinusIcon, MoreHorizontalIcon, RefreshCwIcon, Undo2Icon, XIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { DocumentPreviewDialog } from '@/components/document-viewer-dialog';
import { DatePicker } from '@/components/form/date-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { bannerStyles } from '@/components/ui/banner';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store';
import { YEAR_LEVEL_OPTIONS, labelFor } from '@/features/applications/types';
import { fetchMyEnrollments } from '@/features/students/api';
import { useProgramLabel } from '@/features/programs/hooks';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, createDroppingRequest, downloadDroppingFile, droppingAction, droppingBlob, fetchDroppingRequest, fetchDroppingRequests, type DroppingRequest, type DropStatus } from './api';
import { SubmittedDocument } from './submitted-document';
import { ApprovedRequestCharges, ApprovedRequestReturn } from './approved-request';
import { PendingRequestCharges } from './pending-request-charges';
import { NEW_STUDENT_DROPPING_PATH, studentDroppingPath } from './paths';

import { RequestAssessment } from '@/features/dropping-finance/assessment-summary';
import { fetchAssessment, philippinesToday } from '@/features/dropping-finance/api';

import { DroppingSubmissionForm } from './dropping-submission-form';

const openStatuses: DropStatus[] = ['draft', 'submitted', 'needs_correction'];
const dateLabel = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });

function Status({ status }: { status: DropStatus }) {
  return <Badge variant={status === 'needs_correction' || status === 'rejected' ? 'destructive' : status === 'confirmed' ? 'default' : 'secondary'}>{STATUS_LABELS[status]}</Badge>;
}
function ErrorText({ error }: { error: unknown }) {
  return error ? <p role="alert" className="text-destructive text-sm">{getErrorMessage(error)}</p> : null;
}

export default function DroppingPage() {
  const role = useAuthStore(s => s.user?.role);
  const staff = role === 'admin' || role === 'cashier';
  const { id } = useParams();
  return id ? <DroppingDetail key={id} id={Number(id)} staff={staff} admin={role === 'admin'} /> : <DroppingList staff={staff} />;
}

export function StudentDroppingTab() {
  const [params, setParams] = useSearchParams();
  const request = params.get('request');
  const id = request && /^[1-9]\d*$/.test(request) ? Number(request) : null;
  if (id && Number.isSafeInteger(id)) return <Navigate to={studentDroppingPath(id)} replace />;
  return <>
    <DroppingList staff={false} embedded />
    {request === 'new' && <NewDroppingRequest onClose={() => setParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('request');
      return next;
    }, { replace: true })} />}
  </>;
}

function NewDroppingRequest({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  const program = useProgramLabel();
  const enrollments = useQuery({ queryKey: ['me', 'enrollments', userId], queryFn: fetchMyEnrollments, enabled: !!userId });
  const requests = useQuery({ queryKey: ['dropping', false], queryFn: () => fetchDroppingRequests(false) });
  const current = enrollments.data?.find(e => e.isCurrent && e.status === 'enrolled');
  const existing = requests.data?.find(r => openStatuses.includes(r.status) && (!current || r.enrollmentId === current.id));
  const submitting = useRef(false);
  const create = useMutation({
    mutationFn: createDroppingRequest,
    onSuccess: data => {
      cache.setQueryData(['dropping', data.id], data);
      void cache.invalidateQueries({ queryKey: ['dropping', false] });
      navigate(studentDroppingPath(data.id), { replace: true });
    },
    onSettled: () => { submitting.current = false; },
  });
  const overview = '/portal/programs?section=overview';
  const loading = enrollments.isPending || requests.isPending;
  const failed = enrollments.isError || requests.isError;
  if (!loading && !failed && existing) return <Navigate to={studentDroppingPath(existing.id)} replace />;

  return <Dialog open onOpenChange={open => { if (!open && !create.isPending) onClose(); }}>
    <DialogContent
      className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl p-0 [&>[data-slot=dialog-close]]:top-2.5 [&>[data-slot=dialog-close]]:right-2.5 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center"
      showCloseButton={!create.isPending}
      onInteractOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { if (create.isPending) event.preventDefault(); }}
      onCloseAutoFocus={event => {
        const target = document.getElementById('student-request-drop') ?? document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        if (target) { event.preventDefault(); target.focus(); }
      }}
    >
      <DialogHeader className="shrink-0 border-b p-5 pr-14 text-left">
        <DialogTitle>Request to drop</DialogTitle>
        <DialogDescription className={current ? undefined : 'sr-only'}>{current
          ? `${program(current.program)} · ${labelFor(YEAR_LEVEL_OPTIONS, current.yearLevel ?? '')} · SY ${current.schoolYear}`
          : 'Submit your reason and signed documents for school review.'}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto p-5">
        {loading ? <p role="status" className="text-sm text-muted-foreground">Opening request form…</p>
          : failed ? <div className="space-y-3"><p className="font-medium">Unable to open the request form</p><ErrorText error={enrollments.error || requests.error} /><Button variant="outline" onClick={() => { void enrollments.refetch(); void requests.refetch(); }}>Try again</Button></div>
          : !current ? <div className="space-y-3"><p className="font-medium">No active enrollment to drop</p><Button asChild variant="outline"><Link to={overview}>Back to Overview</Link></Button></div>
          : <DroppingSubmissionForm busy={create.isPending} error={create.error} onCancel={onClose} onSubmit={data => {
          if (submitting.current) return;
          submitting.current = true;
          data.append('enrollmentId', String(current.id));
          create.mutate(data);
        }} />}
      </div>
    </DialogContent>
  </Dialog>;
}

function DroppingList({ staff, embedded = false }: { staff: boolean; embedded?: boolean }) {
  const navigate = useNavigate();
  const program = useProgramLabel();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const list = useQuery({ queryKey: ['dropping', staff], queryFn: () => fetchDroppingRequests(staff) });
  const userId = useAuthStore(state => state.user?.id);
  const enrollments = useQuery({ queryKey: ['me', 'enrollments', userId], queryFn: fetchMyEnrollments, enabled: !staff && !!userId });
  const current = enrollments.data?.find(e => e.isCurrent && e.status === 'enrolled');
  const canRequest = !staff && !enrollments.isError && !!current && list.isSuccess && !list.data.some(r => r.enrollmentId === current.id && openStatuses.includes(r.status));
  const startAction = canRequest ? <Button id="student-request-drop" onClick={() => navigate(NEW_STUDENT_DROPPING_PATH)}><FileMinusIcon aria-hidden="true" />Request to drop</Button> : undefined;
  const rows = (list.data ?? []).filter(r => !staff || ((filter === 'all' || r.status === filter) && `${r.reference} ${r.snapshot.studentName} ${r.snapshot.studentNumber}`.toLowerCase().includes(search.toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const detailPath = (id: number) => staff ? `/admin/dropping-requests/${id}` : studentDroppingPath(id);
  return <div className={embedded || staff ? 'min-w-0 space-y-4' : 'mx-auto max-w-6xl space-y-4'}>
    {!embedded && <PageHeader title="Dropping requests" description={staff ? undefined : 'Track your requests, decisions, and submitted documents.'} />}
    <div className="bg-card overflow-hidden rounded-xl border">
      {staff && <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <Input aria-label="Search dropping requests" placeholder={staff ? 'Search reference or student…' : 'Search by reference…'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="sm:max-w-sm" />
        <Select value={filter} onValueChange={value => { setFilter(value); setPage(1); }}><SelectTrigger className="w-full sm:w-56" aria-label="Request status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </div>}
      {list.isPending ? <p className="p-6 text-sm" role="status">Loading requests…</p> : list.isError ? <div className="space-y-3 p-6"><ErrorText error={list.error} /><Button variant="outline" onClick={() => list.refetch()}>Try again</Button></div> : rows.length === 0 ? staff ? <p className="text-muted-foreground p-6 text-sm">No dropping requests found.</p> : <div className="p-6 sm:py-8"><EmptyState icon={FileMinusIcon} title="No dropping requests yet" description="Your submitted requests and school decisions will appear here." action={startAction} /></div> : <>
        {startAction && <div className="flex justify-end border-b p-4">{startAction}</div>}
        <Table aria-label="Dropping requests">
          <TableHeader><TableRow>
            <TableHead>Reference</TableHead>{staff && <TableHead>Student</TableHead>}<TableHead>School year</TableHead><TableHead>Program</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{pageRows.map(r => <TableRow key={r.id} className="cursor-pointer" onClick={event => {
            if (!(event.target as HTMLElement).closest('a, button')) navigate(detailPath(r.id));
          }}>
            <TableCell><Link className="text-primary font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring" to={detailPath(r.id)}>{r.reference}</Link></TableCell>
            {staff && <TableCell><div className="font-medium">{r.snapshot.studentName}</div><div className="text-muted-foreground text-xs">{r.snapshot.studentNumber}</div></TableCell>}
            <TableCell>{r.snapshot.schoolYear}</TableCell>
            <TableCell><span title={program(r.snapshot.program)}>{r.snapshot.program.toUpperCase()}</span></TableCell>
            <TableCell>{dateLabel(r.createdAt)}</TableCell>
            <TableCell><Status status={r.status} /></TableCell>
            <TableCell className="text-right"><Button asChild variant="ghost" size="icon"><Link to={detailPath(r.id)} aria-label={`View details for ${r.reference}`} title="View details"><ChevronRightIcon aria-hidden="true" /></Link></Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-muted-foreground text-sm" role="status">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} of {rows.length} requests</p>
          <nav aria-label="Request pagination" className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <span className="text-muted-foreground text-sm">Page {currentPage} of {pageCount}</span>
            <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </nav>
        </div>
      </>}
    </div>
  </div>;
}

function DroppingDetail({ id, staff, admin }: { id: number; staff: boolean; admin: boolean }) {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['dropping', id], queryFn: () => fetchDroppingRequest(id) });
  const today = philippinesToday();
  const estimate = useQuery({ queryKey: ['dropping-assessment', id, today], queryFn: () => fetchAssessment(id, today), enabled: !!query.data && !query.data.droppingAssessment && openStatuses.includes(query.data.status) });
  const [fileError, setFileError] = useState<unknown>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [preview, setPreview] = useState<{ id: string; url: string; name: string; mime: string } | null>(null);
  const previewSequence = useRef(0);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; payload: Record<string, unknown>; title: string; description: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => () => { previewSequence.current += 1; }, []);
  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: Record<string, unknown> | FormData }) => droppingAction(id, action, staff, payload instanceof FormData ? payload : { version: query.data?.packetVersion, ...payload }),
    onSuccess: data => { cache.setQueryData(['dropping', id], data); cache.invalidateQueries(); setConfirmAction(null); },
  });
  const download = async (path: string, name: string) => {
    setFileError(null); setFileBusy(true);
    try { await downloadDroppingFile(path, name); } catch (e) { setFileError(e); } finally { setFileBusy(false); }
  };
  const handlePreview = async (file: { id: string; name: string; mime: string }, trigger: HTMLButtonElement | null) => {
    const sequence = ++previewSequence.current;
    const blob = await droppingBlob(`/dropping-requests/${id}/files/${file.id}`);
    // A slow response must not replace a more recently selected document.
    if (sequence !== previewSequence.current) return;
    previewTrigger.current = trigger;
    setFileError(null);
    setPreview({ id: file.id, url: URL.createObjectURL(blob), name: file.name, mime: file.mime });
  };
  const back = staff ? '/admin/dropping-requests' : studentDroppingPath();
  const backLink = <Link to={back} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ArrowLeftIcon className="size-4" aria-hidden="true" />Dropping requests</Link>;
  if (query.isPending) return <div className="mx-auto max-w-7xl space-y-6" role="status"><span className="sr-only">Loading dropping request…</span>{backLink}<Skeleton className="h-9 w-64" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]"><Skeleton className="h-96 w-full rounded-xl" /><Skeleton className="h-80 w-full rounded-xl" /></div></div>;
  if (!query.data) return <div className="mx-auto max-w-7xl space-y-6">{backLink}<section className="space-y-3 rounded-xl border bg-card p-6"><h1 className="text-lg font-semibold">Unable to load this request</h1><ErrorText error={query.error} /><Button variant="outline" onClick={() => query.refetch()}><RefreshCwIcon />Try again</Button></section></div>;
  const r = query.data;
  const studentApproved = !staff && r.status === 'confirmed';
  const expandedDetails = !studentApproved;
  const RequestDetails = studentApproved ? 'details' : 'section';
  const DetailHeading = expandedDetails ? 'h3' : 'h2';
  const reviewable = r.status === 'submitted';
  const editable = !staff && ['draft', 'needs_correction'].includes(r.status);
  const lastNote = [...r.events].reverse().find(e => ['needs_correction', 'rejected'].includes(e.action));
  const latestSubmission = r.submissions.at(-1);
  const setupBlocked = estimate.isError || (!!estimate.data && !estimate.data.ready && (!estimate.data.blockingIssues?.length || estimate.data.blockingIssues.some(issue => issue.category !== 'date')));
  const billAction = staff && r.billId ? <Button asChild variant="outline" size="sm"><Link to={`/admin/billing/${r.billId}`}>View bill<ArrowUpRightIcon aria-hidden="true" /></Link></Button> : undefined;
  const cancelRequest = () => setConfirmAction({ action: 'cancel', payload: {}, title: 'Cancel this dropping request?', description: 'Your enrollment and bills will stay unchanged. This request and its submitted documents will remain in history.' });
  const documentList = (submission: DroppingRequest['submissions'][number]) => <div className={expandedDetails ? 'space-y-4' : 'space-y-8'}>
    <section className="space-y-2" aria-label="Reason for dropping">
      <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-1', !expandedDetails && 'min-h-10')}><DetailHeading className={expandedDetails ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-semibold'}>Reason for dropping</DetailHeading>{!expandedDetails && <time dateTime={submission.submittedAt} className="text-xs text-muted-foreground">Submitted on {dateLabel(submission.submittedAt)}</time>}</div>
      {expandedDetails ? <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{submission.reason}</p> : <blockquote className="border-s border-border py-1 ps-4"><p className="max-w-prose whitespace-pre-wrap text-sm leading-7 text-foreground/85 [overflow-wrap:anywhere]">{submission.reason}</p></blockquote>}
    </section>
    <section className={cn('space-y-3', expandedDetails && 'border-t pt-4')} aria-label="Submitted documents">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><DetailHeading className={expandedDetails ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-semibold'}>Documents</DetailHeading>{submission.version > 1 && <span className="text-xs text-muted-foreground">Version {submission.version}</span>}</div>
      {submission.files.length > 0 ? <ul className="space-y-3">{submission.files.map(file => <SubmittedDocument key={file.id} file={file} onPreview={handlePreview} />)}</ul> : <p className="text-sm text-muted-foreground">No documents were included in this submission.</p>}
    </section>
  </div>;
  const activityList = <ol>{[...r.events].reverse().map((event, index, events) => <li key={index} className="relative flex gap-3 pb-6 last:pb-0">
            {index < events.length - 1 && <span className="absolute bottom-0 left-2 top-5 w-px bg-border" aria-hidden="true" />}
            <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-background" aria-hidden="true"><span className="size-1 rounded-full bg-muted-foreground" /></span>
            <div className="min-w-0 flex-1 space-y-1"><div className={expandedDetails ? 'flex flex-col gap-1' : 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'}><p className="text-sm font-medium">{event.action === 'submitted' ? 'Documents submitted' : event.action === 'created' ? 'Request created' : event.action in STATUS_LABELS ? STATUS_LABELS[event.action as DropStatus] : event.action.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())}</p><time dateTime={event.at} className="text-xs tabular-nums text-muted-foreground">{dateLabel(event.at)} · {new Date(event.at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}</time></div><p className="break-words text-xs text-muted-foreground">{event.actorName}{event.actorRole === 'admin' && ' · Administrator'}</p>{event.remarks && event.action !== 'submitted' && <p className="pt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">{event.remarks.replace(/Packet version \d+ submitted\./g, 'Documents submitted.').replace(/\bpacket\b/gi, 'documents')}</p>}</div>
          </li>)}</ol>;
  const requestHistory = r.events.length > 0 && <details className={studentApproved ? 'group min-w-0 border-t px-5 py-2 open:pb-5 sm:px-6' : 'group min-w-0 border-b pb-4'} aria-label="Request history">
          <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden ${studentApproved ? '' : 'text-muted-foreground'}`}>{!studentApproved && <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />}{studentApproved ? 'Request history' : <>Activity <span className="font-normal">({r.events.length})</span><span className="ml-auto text-xs font-normal">Created {dateLabel(r.createdAt)}</span></>}{studentApproved && <ChevronRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />}</summary>
          <div className="pt-5">{activityList}</div>
        </details>;
  return <Sheet><div className={`mx-auto min-w-0 max-w-7xl pb-4 selection:bg-primary/15 [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3] ${studentApproved ? 'space-y-6' : 'space-y-5'}`}>
    <header className={studentApproved ? 'space-y-3' : 'space-y-5'}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-3 text-sm">{backLink}<span className="text-muted-foreground/60" aria-hidden="true">/</span><span className="text-muted-foreground" aria-current="page">{r.reference}</span></nav>
      {studentApproved ? <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Dropping request</h1>
              <Badge variant="outline" className="h-6 gap-1.5 border-emerald-600/20 bg-emerald-50 px-2.5 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-950 dark:text-emerald-200"><CircleCheckIcon className="size-3.5" aria-hidden="true" />Approved</Badge>
            </div>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{r.snapshot.program.toUpperCase()}</span><span aria-hidden="true">·</span><span className="capitalize">{r.snapshot.yearLevel.replaceAll('_', ' ')}</span><span aria-hidden="true">·</span><span>SY {r.snapshot.schoolYear}</span>
            </p>
          </div>
          <dl className="border-t pt-4 lg:max-w-xs lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">Dropped effective</dt>
              <dd className="text-sm font-medium">{r.effectiveDate ? <time dateTime={r.effectiveDate}>{dateLabel(r.effectiveDate)}</time> : 'Effective dropping date not recorded — contact the school.'}</dd>
            </div>
          </dl>
        </div>
        {r.finalRemarks && <div className="flex flex-col gap-x-4 gap-y-1 border-t bg-muted/20 px-5 py-3 sm:flex-row sm:items-baseline sm:px-6">
          <p className="shrink-0 text-xs font-medium text-muted-foreground">School remarks</p>
          <p className="min-w-0 max-w-prose whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{r.finalRemarks}</p>
        </div>}
      </div> : <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><h1 className="break-words text-2xl font-semibold tracking-tight">{staff ? r.snapshot.studentName : 'Dropping request'}</h1><Status status={r.status} /></div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {!staff && <><span>{r.snapshot.studentName}</span><span aria-hidden="true">·</span></>}
            {staff ? <Link to={`/admin/students/${r.studentId}`} className="inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" aria-label={`Student record for ${r.snapshot.studentName}`}>{r.snapshot.studentNumber}<ArrowUpRightIcon className="size-3.5" aria-hidden="true" /></Link> : <span>{r.snapshot.studentNumber}</span>}
            <span aria-hidden="true">·</span><span>{r.snapshot.program.toUpperCase()}</span><span aria-hidden="true">·</span><span className="capitalize">{r.snapshot.yearLevel.replaceAll('_', ' ')}</span><span aria-hidden="true">·</span><span>SY {r.snapshot.schoolYear}</span>
          </p>
        </div>
        {admin && reviewable && <FinalDecision requestId={r.id} key={`${r.id}-${r.packetVersion}`} busy={mutation.isPending} setupBlocked={setupBlocked} checking={estimate.isPending || estimate.isFetching} onDecision={(action, payload) => mutation.mutateAsync({ action, payload: { ...payload, version: r.packetVersion } })} />}
      </div>}
    </header>
    {studentApproved && <ApprovedRequestCharges request={r}><ApprovedRequestReturn request={r} /></ApprovedRequestCharges>}
    <ErrorText error={mutation.error} />
    {!staff && (r.status === 'needs_correction' || r.status === 'rejected') && lastNote && <section role="status" className="space-y-2 rounded-xl border bg-card p-5 text-sm"><h2 className="font-semibold">{r.status === 'needs_correction' ? 'Changes requested' : 'Request rejected'}</h2><p className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{lastNote.remarks}</p></section>}
    {reviewable && !staff && <section role="status" aria-labelledby="request-status-title" className={cn(bannerStyles({ tone: 'info' }), 'flex items-start gap-3')}><Clock3Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div className="space-y-1"><h2 id="request-status-title" className="font-semibold">Waiting for school approval</h2><p className="leading-relaxed">Your enrollment stays active. We’ll notify you when there’s an update.</p></div></section>}
    <div className={studentApproved ? 'overflow-hidden rounded-xl border bg-card' : 'grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch'}>
      <RequestDetails className={studentApproved ? 'group min-w-0 px-5 py-2 open:space-y-4 open:pb-5 sm:px-6' : 'min-w-0 overflow-hidden rounded-xl border bg-card'} aria-label={expandedDetails ? undefined : 'Request details'} aria-labelledby={expandedDetails ? 'request-details-title' : undefined}>
        {studentApproved && <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">{r.snapshot.initiatedBy === 'admin' ? 'Dropping details' : 'Submitted request'}<ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" /></summary>}
        {expandedDetails && <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-4"><h2 id="request-details-title" className="text-sm font-semibold">Request details</h2>{latestSubmission && <time dateTime={latestSubmission.submittedAt} className="text-xs text-muted-foreground">Submitted on {dateLabel(latestSubmission.submittedAt)}</time>}</header>}
        <div className={cn('space-y-5', expandedDetails && 'p-5')}>
        {latestSubmission ? documentList(latestSubmission) : r.snapshot.initiatedBy === 'admin' ? <div className="space-y-3"><p className="text-xs text-muted-foreground">Initiated by administrator · No signed form required</p><div className="space-y-2"><h3 className="text-sm font-medium">Reason for dropping</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{r.reason}</p></div></div> : <p className="text-sm leading-relaxed text-muted-foreground">Documents have not been submitted yet.{!staff && ' Complete the form below to send your request for review.'}</p>}
        {r.status !== 'confirmed' && <ErrorText error={fileError} />}
        {r.submissions.length > 1 && <details className="border-t pt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Previous submissions ({r.submissions.length - 1})</summary><div className="mt-5 space-y-6">{[...r.submissions].reverse().slice(1).map(submission => <section key={submission.version} className="space-y-4 border-t pt-5"><p className="text-xs text-muted-foreground">Submitted {dateLabel(submission.submittedAt)}</p>{documentList(submission)}</section>)}</div></details>}
        {editable && <DroppingSubmissionForm key={r.submissions.length} request={r} busy={mutation.isPending} onSubmit={payload => mutation.mutate({ action: 'submit', payload })}
          onCancel={cancelRequest} />}
        </div>
        {!staff && r.status === 'submitted' && <footer className="flex justify-end border-t bg-muted/20 px-5 py-3"><Button variant="outline" className="text-muted-foreground" disabled={mutation.isPending} onClick={cancelRequest}>Cancel request</Button></footer>}
      </RequestDetails>
      {expandedDetails && <aside className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-labelledby="request-activity-title"><h2 id="request-activity-title" className="border-b px-5 py-4 text-sm font-semibold">Activity</h2><div className="p-5">{r.events.length ? activityList : <p className="text-sm text-muted-foreground">No updates yet.</p>}</div></aside>}
      {studentApproved && requestHistory}
    </div>
    {expandedDetails && openStatuses.includes(r.status) && <PendingRequestCharges assessment={estimate.data} loading={estimate.isPending} failed={estimate.isError} onRetry={() => { void estimate.refetch(); }} staff={staff} actions={billAction} setupAction={staff && setupBlocked && !(admin && reviewable) ? <SheetTrigger asChild><Button variant="outline" size="sm">View setup</Button></SheetTrigger> : undefined} />}
    {staff && r.status === 'confirmed' && <ApprovedRequestCharges request={r} staff actions={billAction} />}
    {staff && !openStatuses.includes(r.status) && r.status !== 'confirmed' && billAction && <div className="flex justify-end">{billAction}</div>}

    <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3] [&>[data-slot=sheet-close]]:size-11">
      <SheetHeader className="border-b p-6 pr-16"><SheetTitle className="text-lg font-semibold">Approval setup</SheetTitle><SheetDescription>Complete the financial setup to enable approval.</SheetDescription></SheetHeader>
      <div className="p-6"><RequestAssessment requestId={r.id} final={r.droppingAssessment} current={r.financialSummary} staff={staff} canConfigure={admin} billId={r.billId} active={openStatuses.includes(r.status)} /></div>
    </SheetContent>
    <DocumentPreviewDialog
      document={preview ? { url: preview.url, fileName: preview.name, contentType: preview.mime } : null}
      onOpenChange={open => { if (!open) setPreview(null); }}
      onCloseAutoFocus={event => { event.preventDefault(); previewTrigger.current?.focus(); }}
      onDownload={() => { if (preview) void download(`/dropping-requests/${id}/files/${preview.id}`, preview.name); }}
      isDownloading={fileBusy}
      downloadError={fileError ? getErrorMessage(fileError) : null}
    />
    <Dialog open={!!confirmAction} onOpenChange={open => { if (!open && !mutation.isPending) setConfirmAction(null); }}><DialogContent showCloseButton={!mutation.isPending} className="w-[calc(100%-2rem)]"><DialogHeader><DialogTitle>{confirmAction?.title}</DialogTitle><DialogDescription>{confirmAction?.description}</DialogDescription></DialogHeader><ErrorText error={mutation.error} /><div className="flex justify-end gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirmAction(null)}>Keep request</Button><Button variant="destructive" disabled={mutation.isPending} onClick={() => confirmAction && mutation.mutate(confirmAction)}>{mutation.isPending ? 'Cancelling…' : 'Cancel request'}</Button></div></DialogContent></Dialog>
  </div></Sheet>;
}


function FinalDecision({ requestId, busy, setupBlocked, checking, onDecision }: { requestId: number; busy: boolean; setupBlocked: boolean; checking: boolean; onDecision: (action: string, payload: Record<string, unknown>) => Promise<unknown> }) {
  const [decision, setDecision] = useState('');
  const [decisionOpen, setDecisionOpen] = useState(false);
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [remarks, setRemarks] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [error, setError] = useState<unknown>(null);
  const confirming = decision === 'confirm';
  const latestEffectiveDate = philippinesToday();
  const calendarEnd = new Date(`${latestEffectiveDate}T00:00:00`);
  const assessment = useQuery({ queryKey: ['dropping-assessment', requestId, effectiveDate], queryFn: () => fetchAssessment(requestId, effectiveDate), enabled: decisionOpen && confirming && !!effectiveDate, staleTime: 0 });
  const title = confirming ? 'Approve drop' : decision === 'needs_correction' ? 'Return for correction' : 'Reject request';
  const open = (action: string) => { setRemarks(''); setEffectiveDate(''); setError(null); setDecision(action); setDecisionOpen(true); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || (confirming && (!effectiveDate || effectiveDate > latestEffectiveDate || assessment.isFetching || assessment.isError || !assessment.data?.ready || !assessment.data.fingerprint))) return;
    setError(null);
    try {
      await onDecision(confirming ? 'confirm' : 'decision', confirming ? { effectiveDate, remarks, assessmentFingerprint: assessment.data?.fingerprint } : { outcome: decision, remarks });
      setDecisionOpen(false);
    } catch (failure) { setError(failure); if (confirming) void assessment.refetch(); }
  };
  return <section className="flex shrink-0 items-center gap-2" aria-label="Request actions">
    {setupBlocked && !checking ? <SheetTrigger asChild><Button disabled={busy}>Resolve setup</Button></SheetTrigger> : <Button ref={reviewTrigger} disabled={busy || checking} onClick={() => open('confirm')}>{checking ? 'Checking setup…' : 'Approve'}</Button>}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={menuTrigger} variant="outline" size="icon" disabled={busy} aria-label="More request actions"><MoreHorizontalIcon aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="min-h-11" onSelect={() => open('needs_correction')}><Undo2Icon aria-hidden="true" />Return</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={() => open('rejected')}><XIcon aria-hidden="true" />Reject</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={decisionOpen} onOpenChange={isOpen => { if (!busy) setDecisionOpen(isOpen); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); (confirming ? reviewTrigger : menuTrigger).current?.focus(); }} showCloseButton={!busy} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{confirming ? 'Choose the effective dropping date. Approving this request ends the student’s enrollment.' : decision === 'needs_correction' ? 'Explain what the student needs to update before submitting again.' : 'Explain why this request is being rejected. Enrollment stays unchanged.'}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {confirming && <div className="space-y-2"><Label htmlFor="effective-date">Effective date</Label><DatePicker id="effective-date" value={effectiveDate} onChange={setEffectiveDate} placeholder="Select effective date" endMonth={calendarEnd} disabledDates={{ after: calendarEnd }} disabled={busy} /><p className="text-xs text-muted-foreground">Between enrollment and today.</p></div>}
          {confirming && effectiveDate && (assessment.isFetching ? <p role="status" className="text-xs text-muted-foreground">Checking approval eligibility…</p> : assessment.isError ? <div className="space-y-2"><ErrorText error={assessment.error} /><Button type="button" variant="outline" size="sm" onClick={() => assessment.refetch()}>Try again</Button></div> : assessment.data && (!assessment.data.ready || !assessment.data.fingerprint) ? <p role="alert" className="text-sm text-destructive">{assessment.data.issues[0] ?? 'Approval is unavailable for this date. Choose another date or resolve the approval setup.'}</p> : null)}
          <div className="space-y-2"><Label htmlFor="decision-remarks">{confirming ? 'Notes (optional)' : decision === 'needs_correction' ? 'What needs correcting?' : 'Reason for rejection'}</Label><Textarea id="decision-remarks" required={!confirming} maxLength={2000} value={remarks} onChange={e => setRemarks(e.target.value)} disabled={busy} /></div>
          <ErrorText error={error} />
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setDecisionOpen(false)}>Cancel</Button><Button type="submit" variant={decision === 'rejected' ? 'destructive' : 'default'} disabled={busy || (confirming ? !effectiveDate || assessment.isFetching || assessment.isError || !assessment.data?.ready || !assessment.data.fingerprint : !remarks.trim())}>{busy ? 'Saving…' : title}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
