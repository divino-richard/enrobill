import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, ArrowUpRightIcon, ChevronRightIcon, CircleCheckIcon, DownloadIcon, Loader2Icon, MoreHorizontalIcon, RefreshCwIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store';
import { YEAR_LEVEL_OPTIONS, labelFor } from '@/features/applications/types';
import { fetchMyEnrollments } from '@/features/students/api';
import { useProgramLabel } from '@/features/programs/hooks';
import { getErrorMessage } from '@/lib/get-error-message';
import { formatPeso } from '@/lib/money';
import { STATUS_LABELS, createDroppingRequest, downloadDroppingFile, droppingAction, droppingBlob, fetchDroppingRequest, fetchDroppingRequests, type DroppingRequest, type DropStatus } from './api';
import { SubmittedDocument } from './submitted-document';
import { ApprovedRequestCharges, ApprovedRequestReturn } from './approved-request';
import { studentDroppingPath } from './paths';

import { AssessmentSummary, RequestAssessment } from '@/features/dropping-finance/assessment-summary';
import { fetchAssessment, philippinesToday } from '@/features/dropping-finance/api';

const PdfPreview = lazy(() => import('@/components/pdf-preview'));

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
  const [params] = useSearchParams();
  const request = params.get('request');
  if (request === 'new') return <NewDroppingRequest />;
  const id = request && /^[1-9]\d*$/.test(request) ? Number(request) : null;
  return id && Number.isSafeInteger(id)
    ? <Navigate to={studentDroppingPath(id)} replace />
    : <DroppingList staff={false} embedded />;
}

function NewDroppingRequest() {
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
  if (enrollments.isPending || requests.isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Opening request form…</p>;
  if (enrollments.isError || requests.isError) return <section className="space-y-4 rounded-xl border bg-card p-6"><h2 className="font-semibold">Unable to open the request form</h2><ErrorText error={enrollments.error || requests.error} /><Button variant="outline" onClick={() => { void enrollments.refetch(); void requests.refetch(); }}>Try again</Button></section>;
  if (existing) return <Navigate to={studentDroppingPath(existing.id)} replace />;
  if (!current) return <section className="space-y-3 rounded-xl border bg-card p-6"><h2 className="font-semibold">No active enrollment to drop</h2><p className="text-sm text-muted-foreground">Return to Overview to check your enrollment.</p><Button asChild variant="outline"><Link to={overview}>Back to Overview</Link></Button></section>;

  return <div className="min-w-0 space-y-3">
    <Button asChild variant="ghost" size="sm" disabled={create.isPending}><Link to={overview} aria-disabled={create.isPending} onClick={event => { if (create.isPending) event.preventDefault(); }}><ArrowLeftIcon aria-hidden="true" />Back to Overview</Link></Button>
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="space-y-1 border-b p-5 sm:px-6">
        <h2 className="text-lg font-semibold">Request to drop</h2>
        <p className="text-sm text-muted-foreground">{program(current.program)} · {labelFor(YEAR_LEVEL_OPTIONS, current.yearLevel ?? '')} · SY {current.schoolYear}</p>
      </header>
      <div className="p-5 sm:p-6">
        <UploadDocuments busy={create.isPending} error={create.error} onCancel={() => navigate(overview)} onSubmit={data => {
          if (submitting.current) return;
          submitting.current = true;
          data.append('enrollmentId', String(current.id));
          create.mutate(data);
        }} />
      </div>
    </section>
  </div>;
}

function DroppingList({ staff, embedded = false }: { staff: boolean; embedded?: boolean }) {
  const navigate = useNavigate();
  const program = useProgramLabel();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const list = useQuery({ queryKey: ['dropping', staff], queryFn: () => fetchDroppingRequests(staff) });
  const rows = (list.data ?? []).filter(r => (filter === 'all' || r.status === filter) && `${r.reference} ${r.snapshot.studentName} ${r.snapshot.studentNumber}`.toLowerCase().includes(search.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const detailPath = (id: number) => staff ? `/admin/dropping-requests/${id}` : studentDroppingPath(id);
  return <div className={embedded ? 'min-w-0 space-y-4' : 'mx-auto max-w-6xl space-y-4'}>
    {!embedded && <PageHeader title="Dropping requests" description={staff ? undefined : 'Track your requests, decisions, and submitted documents.'} />}
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <Input aria-label="Search dropping requests" placeholder={staff ? 'Search reference or student…' : 'Search by reference…'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="sm:max-w-sm" />
        <Select value={filter} onValueChange={value => { setFilter(value); setPage(1); }}><SelectTrigger className="w-full sm:w-56" aria-label="Request status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </div>
      {list.isPending ? <p className="p-6 text-sm" role="status">Loading requests…</p> : list.isError ? <div className="space-y-3 p-6"><ErrorText error={list.error} /><Button variant="outline" onClick={() => list.refetch()}>Try again</Button></div> : rows.length === 0 ? <p className="text-muted-foreground p-6 text-sm">No dropping requests found.</p>  : <>
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
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null);
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
    setPreview({ url: URL.createObjectURL(blob), name: file.name, mime: file.mime });
  };
  const back = staff ? '/admin/dropping-requests' : studentDroppingPath();
  const backLink = <Link to={back} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ArrowLeftIcon className="size-4" aria-hidden="true" />Dropping requests</Link>;
  if (query.isPending) return <div className="mx-auto max-w-6xl space-y-6" role="status"><span className="sr-only">Loading dropping request…</span>{backLink}<Skeleton className="h-9 w-64" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]"><Skeleton className="h-96 w-full rounded-xl" /><Skeleton className="h-80 w-full rounded-xl" /></div></div>;
  if (!query.data) return <div className="mx-auto max-w-6xl space-y-6">{backLink}<section className="space-y-3 rounded-xl border bg-card p-6"><h1 className="text-lg font-semibold">Unable to load this request</h1><ErrorText error={query.error} /><Button variant="outline" onClick={() => query.refetch()}><RefreshCwIcon />Try again</Button></section></div>;
  const r = query.data;
  const studentApproved = !staff && r.status === 'confirmed';
  const RequestDetails = studentApproved ? 'details' : 'section';
  const reviewable = r.status === 'submitted';
  const editable = !staff && ['draft', 'needs_correction'].includes(r.status);
  const lastNote = [...r.events].reverse().find(e => ['needs_correction', 'rejected'].includes(e.action));
  const latestSubmission = r.submissions.at(-1);
  const setupBlocked = estimate.isError || (!!estimate.data && !estimate.data.ready && (!estimate.data.blockingIssues?.length || estimate.data.blockingIssues.some(issue => issue.category !== 'date')));
  const cancelRequest = () => setConfirmAction({ action: 'cancel', payload: {}, title: 'Cancel this dropping request?', description: 'Your enrollment and bills will stay unchanged. This request and its submitted documents will remain in history.' });
  const documentList = (submission: DroppingRequest['submissions'][number]) => <div className="space-y-8">
    <section className="space-y-2" aria-label="Reason for dropping">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1"><h2 className="text-sm font-semibold">Reason for dropping</h2><time dateTime={submission.submittedAt} className="text-xs text-muted-foreground">Submitted on {dateLabel(submission.submittedAt)}</time></div>
      <blockquote className="border-s border-border py-1 ps-4"><p className="max-w-prose whitespace-pre-wrap text-sm leading-7 text-foreground/85 [overflow-wrap:anywhere]">{submission.reason}</p></blockquote>
    </section>
    <section className="space-y-3" aria-label="Submitted documents">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Documents <span className="ml-1 font-normal text-muted-foreground">({submission.files.length})</span></h2>{submission.version > 1 && <span className="text-xs text-muted-foreground">Version {submission.version}</span>}</div>
      {submission.files.length > 0 ? <ul className="divide-y border-y">{submission.files.map(file => <SubmittedDocument key={file.id} file={file} onPreview={handlePreview} onDownload={() => downloadDroppingFile(`/dropping-requests/${id}/files/${file.id}`, file.name)} />)}</ul> : <p className="text-sm text-muted-foreground">No documents were included in this submission.</p>}
    </section>
  </div>;
  const requestHistory = r.events.length > 0 && <details className={studentApproved ? 'group min-w-0 border-t px-5 py-2 open:pb-5 sm:px-6' : 'group min-w-0 border-b pb-4'} aria-label="Request history">
          <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden ${studentApproved ? '' : 'text-muted-foreground'}`}>{!studentApproved && <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />}{studentApproved ? 'Request history' : <>Activity <span className="font-normal">({r.events.length})</span><span className="ml-auto text-xs font-normal">Created {dateLabel(r.createdAt)}</span></>}{studentApproved && <ChevronRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />}</summary>
          <ol className="pt-5">{[...r.events].reverse().map((event, index, events) => <li key={index} className="relative flex gap-3 pb-6 last:pb-0">
            {index < events.length - 1 && <span className="absolute bottom-0 left-2 top-5 w-px bg-border" aria-hidden="true" />}
            <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-background" aria-hidden="true"><span className="size-1 rounded-full bg-muted-foreground" /></span>
            <div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="text-sm font-medium">{event.action === 'submitted' ? 'Documents submitted' : event.action === 'created' ? 'Request created' : event.action in STATUS_LABELS ? STATUS_LABELS[event.action as DropStatus] : event.action.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())}</p><time dateTime={event.at} className="text-xs tabular-nums text-muted-foreground">{dateLabel(event.at)} · {new Date(event.at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}</time></div><p className="break-words text-xs text-muted-foreground">{event.actorName}</p>{event.remarks && event.action !== 'submitted' && <p className="pt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">{event.remarks.replace(/Packet version \d+ submitted\./g, 'Documents submitted.').replace(/\bpacket\b/gi, 'documents')}</p>}</div>
          </li>)}</ol>
        </details>;
  return <Sheet><div className={`mx-auto min-w-0 ${staff ? 'max-w-6xl' : 'max-w-7xl'} pb-4 selection:bg-primary/15 [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3] ${studentApproved ? 'space-y-6' : 'space-y-7'}`}>
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
        {admin && reviewable && <FinalDecision requestId={r.id} billId={r.billId} key={`${r.id}-${r.packetVersion}`} busy={mutation.isPending} setupBlocked={setupBlocked} checking={estimate.isPending || estimate.isFetching} onDecision={(action, payload) => mutation.mutateAsync({ action, payload: { ...payload, version: r.packetVersion } })} />}
        {r.status === 'confirmed' && admin && <Button variant="outline" className="min-h-11" disabled={fileBusy} onClick={() => download(`/dropping-requests/${id}/acknowledgment`, `${r.reference}-acknowledgment.html`)}>{fileBusy ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}{fileBusy ? 'Preparing approval…' : 'Download approval'}</Button>}
      </div>}
      {r.status === 'confirmed' && admin && <ErrorText error={fileError} />}
    </header>
    {studentApproved && <ApprovedRequestCharges request={r}><ApprovedRequestReturn request={r} /></ApprovedRequestCharges>}
    <ErrorText error={mutation.error} />
    {r.status === 'confirmed' && !studentApproved && <section className="flex items-start gap-3 rounded-xl border bg-card p-5" aria-label="Approval confirmation"><CircleCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="space-y-1 text-sm"><h2 className="font-semibold">{r.effectiveDate ? `Officially dropped effective ${dateLabel(r.effectiveDate)}` : 'Your drop has been approved'}</h2>{r.finalRemarks && <p className="whitespace-pre-wrap break-words">{r.finalRemarks}</p>}<p className="leading-relaxed text-muted-foreground">Records and account access remain available. Dropping charges are payable upon re-enrollment. No immediate payment or clearance is required. View re-enrollment to check your return deadline and available school year.</p></div></section>}
    {(r.status === 'needs_correction' || r.status === 'rejected') && lastNote && <section role="status" className="space-y-2 rounded-xl border bg-card p-5 text-sm"><h2 className="font-semibold">{r.status === 'needs_correction' ? 'Changes requested' : 'Request rejected'}</h2><p className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{lastNote.remarks}</p></section>}
    {reviewable && !staff && <p className="rounded-xl border bg-card p-5 text-sm leading-relaxed">Your request is waiting for approval. We’ll notify you when there’s an update.</p>}
    <div className={studentApproved ? 'overflow-hidden rounded-xl border bg-card' : 'grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1fr)_21rem]'}>
      <RequestDetails className={studentApproved ? 'group min-w-0 px-5 py-2 open:space-y-4 open:pb-5 sm:px-6' : 'min-w-0 space-y-5 p-5 sm:p-7 lg:p-8'} aria-label="Request details">
        {studentApproved && <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">Submitted request<ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" /></summary>}
        {latestSubmission ? documentList(latestSubmission) : <p className="text-sm leading-relaxed text-muted-foreground">Documents have not been submitted yet.{staff ? ' The student can upload their signed form and supporting documents.' : ' Complete the form below to send your request for review.'}</p>}
        {r.status !== 'confirmed' && <ErrorText error={fileError} />}
        {r.submissions.length > 1 && <details className="border-t pt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Previous submissions ({r.submissions.length - 1})</summary><div className="mt-5 space-y-6">{[...r.submissions].reverse().slice(1).map(submission => <section key={submission.version} className="space-y-4 border-t pt-5"><p className="text-xs text-muted-foreground">Submitted {dateLabel(submission.submittedAt)}</p>{documentList(submission)}</section>)}</div></details>}
        {editable && <UploadDocuments key={r.submissions.length} request={r} busy={mutation.isPending} onSubmit={payload => mutation.mutate({ action: 'submit', payload })}
          onCancel={cancelRequest} />}
        {!staff && r.status === 'submitted' && <Button variant="ghost" disabled={mutation.isPending} onClick={cancelRequest}>Cancel request</Button>}
      </RequestDetails>
      {!studentApproved && <aside className="min-w-0 space-y-6 border-t p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8" aria-label="Financial review">
        <section className="space-y-6" aria-labelledby="financial-review-title">
          <div className="flex items-center justify-between gap-3"><h2 id="financial-review-title" className="text-sm font-semibold">Financial summary</h2>{r.billId && <Link to={staff ? `/admin/billing/${r.billId}` : `/portal/bills/${r.billId}`} className="inline-flex min-h-10 items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">View bill<ArrowUpRightIcon className="size-3.5" aria-hidden="true" /></Link>}</div>
          <dl><div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><dt className="text-muted-foreground">Current balance</dt><dd className="font-semibold tabular-nums">{formatPeso(r.balance)}</dd></div></dl>
          <RequestAssessment compact requestId={r.id} final={r.droppingAssessment} current={r.financialSummary} staff={staff} canConfigure={admin} billId={r.billId} active={openStatuses.includes(r.status)} />
          {staff && setupBlocked && !(admin && reviewable) && <SheetTrigger asChild><Button variant="outline" className="h-10 shadow-none">View setup</Button></SheetTrigger>}
        </section>
        {editable && <section className="space-y-3 border-t pt-5"><h2 className="text-sm font-semibold">Before you submit</h2><ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground"><li>Complete the official form in three copies and collect all applicable signatures.</li><li>Attach your reason letter and confirmation / enrolled-subjects form.</li><li>Upload clear copies of all pages and keep the originals.</li></ul></section>}
      </aside>}
      {studentApproved && requestHistory}
    </div>
    {!studentApproved && requestHistory}

    <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md [--muted-foreground:#626c7d] dark:[--muted-foreground:#aeb4c3] [&>[data-slot=sheet-close]]:size-11">
      <SheetHeader className="border-b p-6 pr-16"><SheetTitle className="text-lg font-semibold">Approval setup</SheetTitle><SheetDescription>Complete the financial setup to enable approval.</SheetDescription></SheetHeader>
      <div className="p-6"><RequestAssessment requestId={r.id} final={r.droppingAssessment} current={r.financialSummary} staff={staff} canConfigure={admin} billId={r.billId} active={openStatuses.includes(r.status)} /></div>
    </SheetContent>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); previewTrigger.current?.focus(); }} aria-describedby={undefined} className="max-h-[90dvh] w-[calc(100%-2rem)] sm:max-w-4xl [&>[data-slot=dialog-close]]:size-11"><DialogHeader><DialogTitle className="break-all pr-10">{preview?.name}</DialogTitle></DialogHeader>{preview?.mime === 'application/pdf' ? <Suspense fallback={<p role="status">Loading PDF…</p>}><PdfPreview url={preview.url} name={preview.name} /></Suspense> : preview && <img alt={preview.name} src={preview.url} className="max-h-[65dvh] w-full object-contain" />}</DialogContent></Dialog>
    <Dialog open={!!confirmAction} onOpenChange={open => { if (!open && !mutation.isPending) setConfirmAction(null); }}><DialogContent showCloseButton={!mutation.isPending} className="w-[calc(100%-2rem)]"><DialogHeader><DialogTitle>{confirmAction?.title}</DialogTitle><DialogDescription>{confirmAction?.description}</DialogDescription></DialogHeader><ErrorText error={mutation.error} /><div className="flex justify-end gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirmAction(null)}>Keep request</Button><Button variant="destructive" disabled={mutation.isPending} onClick={() => confirmAction && mutation.mutate(confirmAction)}>{mutation.isPending ? 'Cancelling…' : 'Cancel request'}</Button></div></DialogContent></Dialog>
  </div></Sheet>;
}

function UploadDocuments({ request, busy, onSubmit, onCancel, error: submissionError }: { request?: DroppingRequest; busy: boolean; onSubmit: (payload: FormData) => void; onCancel: () => void; error?: unknown }) {
  const [reason, setReason] = useState(request?.reason ?? '');
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const files = previews.map(p => p.file);
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews]);
  function selectFiles(next: File[]) {
    setChecked(false); setError('');
    if (next.length > 12 || next.some(f => f.size > 2 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) || next.reduce((s, f) => s + f.size, 0) > 7 * 1024 * 1024) {
      setPreviews([]); setError('Choose up to 12 PDF, JPG, or PNG files, each up to 2 MB and 7 MB total.'); return;
    }
    setPreviews(next.map(file => ({ file, url: URL.createObjectURL(file) })));
  }
  return <form className={request ? "space-y-5 border-t pt-5" : "space-y-5"} onSubmit={event => { event.preventDefault(); if (busy || !checked || !files.length || !reason.trim()) return; const data = new FormData(); data.append('reason', reason); files.forEach(file => data.append('files[]', file)); onSubmit(data); }}>
    {request && <h2 className="text-base font-semibold">{request.status === 'needs_correction' ? 'Update documents' : 'Documents'}</h2>}
    <div className="space-y-2"><Label htmlFor="drop-reason">Reason for dropping</Label><Textarea id="drop-reason" required maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="drop-files">Signed form and attachments</Label><Input id="drop-files" type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={busy} onChange={e => selectFiles(Array.from(e.target.files ?? []))} /><p className="text-muted-foreground text-xs">PDF, JPG or PNG · Up to 12 files · 2 MB each · 7 MB total.</p></div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {previews.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{previews.map((p, i) => <div key={i} className="min-w-0 space-y-2"><p className="break-all text-sm font-medium">{p.file.name}</p>{p.file.type === 'application/pdf' ? <Suspense fallback={<p role="status">Loading PDF…</p>}><PdfPreview url={p.url} name={p.file.name} className="h-80" /></Suspense> : <img src={p.url} alt={`Preview ${p.file.name}`} className="h-64 w-full rounded-md border object-contain" />}<a href={p.url} target="_blank" rel="noreferrer" className="text-primary text-sm underline underline-offset-4">Open full preview</a></div>)}</div>}
    <label className="flex items-start gap-3 text-sm"><Checkbox checked={checked} onCheckedChange={value => setChecked(value === true)} disabled={busy || files.length === 0} className="mt-0.5" /><span>I reviewed my complete, signed documents.</span></label>
    <ErrorText error={submissionError} />
    <div className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">Your enrollment stays active until approval.</p><div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={onCancel}>{request ? 'Cancel request' : 'Cancel'}</Button><Button type="submit" disabled={busy || !checked || files.length === 0 || !reason.trim()}>{busy ? 'Uploading documents…' : 'Submit request'}</Button></div></div>
  </form>;
}

function FinalDecision({ requestId, billId, busy, setupBlocked, checking, onDecision }: { requestId: number; billId: number | null; busy: boolean; setupBlocked: boolean; checking: boolean; onDecision: (action: string, payload: Record<string, unknown>) => Promise<unknown> }) {
  const [decision, setDecision] = useState('');
  const [decisionOpen, setDecisionOpen] = useState(false);
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [remarks, setRemarks] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [error, setError] = useState<unknown>(null);
  const confirming = decision === 'confirm';
  const assessment = useQuery({ queryKey: ['dropping-assessment', requestId, effectiveDate], queryFn: () => fetchAssessment(requestId, effectiveDate), enabled: decisionOpen && confirming && !!effectiveDate, staleTime: 0 });
  const title = confirming ? 'Approve drop' : decision === 'needs_correction' ? 'Return for correction' : 'Reject request';
  const open = (action: string) => { setRemarks(''); setEffectiveDate(''); setError(null); setDecision(action); setDecisionOpen(true); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || (confirming && (assessment.isFetching || assessment.isError || !assessment.data?.ready || !assessment.data.fingerprint))) return;
    setError(null);
    try {
      await onDecision(confirming ? 'confirm' : 'decision', confirming ? { effectiveDate, remarks, assessmentFingerprint: assessment.data?.fingerprint } : { outcome: decision, remarks });
      setDecisionOpen(false);
    } catch (failure) { setError(failure); if (confirming) void assessment.refetch(); }
  };
  return <section className="flex shrink-0 items-center gap-2" aria-label="Request actions">
    {setupBlocked && !checking ? <SheetTrigger asChild><Button className="h-11 px-4" disabled={busy}>Resolve setup</Button></SheetTrigger> : <Button ref={reviewTrigger} className="h-11 px-4" disabled={busy || checking} onClick={() => open('confirm')}>{checking ? 'Checking setup…' : 'Review & approve'}</Button>}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={menuTrigger} variant="outline" size="icon" className="size-11 shadow-none" disabled={busy} aria-label="More request actions"><MoreHorizontalIcon aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="min-h-11" onSelect={() => open('needs_correction')}>Return for correction</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={() => open('rejected')}>Reject request</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={decisionOpen} onOpenChange={isOpen => { if (!busy) setDecisionOpen(isOpen); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); (confirming ? reviewTrigger : menuTrigger).current?.focus(); }} showCloseButton={!busy} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{confirming ? 'Confirm the effective date and review the final charge. Approval ends this enrollment.' : decision === 'needs_correction' ? 'Explain what the student needs to update before submitting again.' : 'Explain why this request is being rejected. Enrollment stays unchanged.'}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {confirming && <div className="space-y-2"><Label htmlFor="effective-date">Effective date</Label><Input id="effective-date" type="date" max={philippinesToday()} required value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} disabled={busy} /><p className="text-xs text-muted-foreground">Between enrollment and today.</p></div>}
          {confirming && effectiveDate && <div className="border-y py-4">{assessment.isFetching ? <p role="status" className="text-sm">Calculating charge…</p> : assessment.isError ? <div className="space-y-2"><ErrorText error={assessment.error} /><Button type="button" variant="outline" size="sm" onClick={() => assessment.refetch()}>Try again</Button></div> : assessment.data && <AssessmentSummary assessment={assessment.data} staff canConfigure billId={billId} />}</div>}
          <div className="space-y-2"><Label htmlFor="decision-remarks">{confirming ? 'Notes (optional)' : decision === 'needs_correction' ? 'What needs correcting?' : 'Reason for rejection'}</Label><Textarea id="decision-remarks" required={!confirming} maxLength={2000} value={remarks} onChange={e => setRemarks(e.target.value)} disabled={busy} /></div>
          <ErrorText error={error} />
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setDecisionOpen(false)}>Cancel</Button><Button type="submit" variant={decision === 'rejected' ? 'destructive' : 'default'} disabled={busy || (confirming ? !effectiveDate || assessment.isFetching || assessment.isError || !assessment.data?.ready || !assessment.data.fingerprint : !remarks.trim())}>{busy ? 'Saving…' : title}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
