import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store';
import { fetchMyEnrollments } from '@/features/students/api';
import { useProgramLabel } from '@/features/programs/hooks';
import { getErrorMessage } from '@/lib/get-error-message';
import { formatPeso } from '@/lib/money';
import { STATUS_LABELS, createDroppingRequest, downloadDroppingFile, droppingAction, droppingBlob, fetchDroppingRequest, fetchDroppingRequests, type DroppingRequest, type DropStatus } from './api';

import { AssessmentSummary, RequestAssessment } from '@/features/dropping-finance/assessment-summary';
import { fetchAssessment, philippinesToday, saveCategory, type DroppingCategory } from '@/features/dropping-finance/api';

const PdfPreview = lazy(() => import('@/components/pdf-preview'));

const openStatuses: DropStatus[] = ['draft', 'submitted', 'needs_correction'];
const dateLabel = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

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

function DroppingList({ staff }: { staff: boolean }) {
  const navigate = useNavigate();
  const program = useProgramLabel();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const list = useQuery({ queryKey: ['dropping', staff], queryFn: () => fetchDroppingRequests(staff) });
  const enrollments = useQuery({ queryKey: ['me', 'enrollments'], queryFn: fetchMyEnrollments, enabled: !staff });
  const create = useMutation({ mutationFn: createDroppingRequest, onSuccess: data => navigate(`/portal/dropping-requests/${data.id}`) });
  const current = enrollments.data?.find(e => e.isCurrent && e.status === 'enrolled');
  const active = list.data?.find(r => r.enrollmentId === current?.id && openStatuses.includes(r.status));
  const rows = (list.data ?? []).filter(r => (filter === 'all' || r.status === filter) && `${r.reference} ${r.snapshot.studentName} ${r.snapshot.studentNumber}`.toLowerCase().includes(search.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <div className="mx-auto max-w-6xl space-y-4">
    <PageHeader title="Dropping requests" description={staff ? undefined : 'Download the official form, collect signatures, and track your request here.'} />
    {!staff && <ErrorText error={create.error || enrollments.error} />}
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <Input aria-label="Search dropping requests" placeholder="Search reference or student…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="sm:max-w-sm" />
        <Select value={filter} onValueChange={value => { setFilter(value); setPage(1); }}><SelectTrigger className="w-full sm:w-56" aria-label="Request status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        {!staff && <Button className="sm:ml-auto" disabled={!current || create.isPending || list.isPending || list.isError} onClick={() => active ? navigate(`/portal/dropping-requests/${active.id}`) : current && create.mutate(current.id)}>{create.isPending && <Loader2Icon className="animate-spin" />}{active ? 'View active request' : 'Request to drop'}</Button>}
      </div>
      {!staff && !current && !enrollments.isPending && !enrollments.isError && <p className="border-b px-4 py-3 text-sm text-muted-foreground">No active enrollment is available for a new request.</p>}
      {list.isPending ? <p className="p-6 text-sm" role="status">Loading requests…</p> : list.isError ? <div className="space-y-3 p-6"><ErrorText error={list.error} /><Button variant="outline" onClick={() => list.refetch()}>Try again</Button></div> : rows.length === 0 ? <p className="text-muted-foreground p-6 text-sm">No dropping requests found.</p>  : <>
        <Table aria-label="Dropping requests">
          <TableHeader><TableRow>
            <TableHead>Reference</TableHead>{staff && <TableHead>Student</TableHead>}<TableHead>School year</TableHead><TableHead>Program</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>{pageRows.map(r => <TableRow key={r.id} className="cursor-pointer" onClick={event => {
            if (!(event.target as HTMLElement).closest('a, button')) navigate(`${staff ? "/admin" : "/portal"}/dropping-requests/${r.id}`);
          }}>
            <TableCell><Link className="text-primary font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring" to={`${staff ? "/admin" : "/portal"}/dropping-requests/${r.id}`}>{r.reference}</Link></TableCell>
            {staff && <TableCell><div className="font-medium">{r.snapshot.studentName}</div><div className="text-muted-foreground text-xs">{r.snapshot.studentNumber}</div></TableCell>}
            <TableCell>{r.snapshot.schoolYear}</TableCell>
            <TableCell><span title={program(r.snapshot.program)}>{r.snapshot.program.toUpperCase()}</span></TableCell>
            <TableCell>{dateLabel(r.createdAt)}</TableCell>
            <TableCell><Status status={r.status} /></TableCell>
            <TableCell className="text-right"><Button asChild variant="ghost" size="icon"><Link to={`${staff ? "/admin" : "/portal"}/dropping-requests/${r.id}`} aria-label={`View details for ${r.reference}`} title="View details"><ChevronRightIcon aria-hidden="true" /></Link></Button></TableCell>
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
  const [fileError, setFileError] = useState<unknown>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; payload: Record<string, unknown>; title: string; description: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const mutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: Record<string, unknown> | FormData }) => droppingAction(id, action, staff, payload instanceof FormData ? payload : { version: query.data?.packetVersion, ...payload }),
    onSuccess: data => { cache.setQueryData(['dropping', id], data); cache.invalidateQueries(); setConfirmAction(null); },
  });
  const download = async (path: string, name: string) => {
    setFileError(null); setFileBusy(true);
    try { await downloadDroppingFile(path, name); } catch (e) { setFileError(e); } finally { setFileBusy(false); }
  };
  const view = async (file: { id: string; name: string; mime: string }) => {
    setFileError(null); setFileBusy(true);
    try { const blob = await droppingBlob(`/dropping-requests/${id}/files/${file.id}`); setPreview({ url: URL.createObjectURL(blob), name: file.name, mime: file.mime }); } catch (e) { setFileError(e); } finally { setFileBusy(false); }
  };
  const back = `${staff ? '/admin' : '/portal'}/dropping-requests`;
  if (query.isPending) return <p role="status">Loading dropping request…</p>;
  if (!query.data) return <div className="space-y-3"><Button asChild variant="outline"><Link to={back}>Back to requests</Link></Button><ErrorText error={query.error} /><Button onClick={() => query.refetch()}>Try again</Button></div>;
  const r = query.data;
  const reviewable = r.status === 'submitted';
  const editable = !staff && ['draft', 'needs_correction'].includes(r.status);
  const lastNote = [...r.events].reverse().find(e => ['needs_correction', 'rejected'].includes(e.action));
  const documents = <>{r.submissions.length > 0 && <section aria-label="Submitted documents" className="space-y-5">
    {[...r.submissions].reverse().map((submission, index) => <div key={submission.version} className="space-y-4 border-t pt-5">
      <div className="space-y-2"><h2 className="text-sm font-semibold">{index === 0 ? 'Reason for dropping' : 'Earlier reason for dropping'}</h2><p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{submission.reason}</p></div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">{index === 0 ? 'Submitted documents' : 'Earlier documents'} <span className="text-muted-foreground font-normal">({submission.files.length})</span></h2><time className="text-muted-foreground text-xs" dateTime={submission.submittedAt}>{dateLabel(submission.submittedAt)}</time></div>
        <ul className="divide-y rounded-lg bg-muted/40 px-3">{submission.files.map(file => <li key={file.id} className="flex flex-wrap items-center gap-3 py-3">
          <FileTextIcon className="text-primary size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 basis-40"><p className="break-all text-sm font-medium">{file.name}</p><p className="text-muted-foreground mt-1 text-xs">{file.mime === 'application/pdf' ? 'PDF document' : 'Image'} · {(file.size / 1024 / 1024).toFixed(1)} MB</p></div>
          <div className="flex shrink-0 items-center gap-1"><Button size="sm" variant="outline" disabled={fileBusy} onClick={() => view(file)} aria-label={`Preview ${file.name}`}>Preview</Button><Button size="icon" variant="ghost" disabled={fileBusy} onClick={() => download(`/dropping-requests/${id}/files/${file.id}`, file.name)} aria-label={`Download ${file.name}`}><DownloadIcon /></Button></div>
        </li>)}</ul>
      </div>
    </div>)}
  </section>}</>;
  const history = <>{r.events.length > 0 && <section className="space-y-4"><h2 className="text-lg font-semibold">Request history</h2>
    <ol className="divide-y">{[...r.events].reverse().map((event, index) => <li key={index} className="space-y-2 py-4 first:pt-0 last:pb-0">
      <p className="text-sm font-semibold">{event.action === 'submitted' ? 'Documents submitted' : event.action === 'created' ? 'Request created' : event.action in STATUS_LABELS ? STATUS_LABELS[event.action as DropStatus] : event.action.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())}</p>
      <time dateTime={event.at} className="text-muted-foreground block text-xs tabular-nums">{dateLabel(event.at)} · {new Date(event.at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</time>
      <p className="text-sm break-words">{event.actorName}</p>
      {event.remarks && event.action !== 'submitted' && <p className="rounded-md bg-muted/50 p-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">{event.remarks.replace(/Packet version \d+ submitted\./g, 'Documents submitted.').replace(/\bpacket\b/gi, 'documents')}</p>}
    </li>)}</ol>
  </section>}</>;
  return <div className="mx-auto max-w-6xl space-y-5">
    <Button asChild variant="ghost" size="sm"><Link to={back}><ArrowLeftIcon />Dropping requests</Link></Button>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
    <div className="min-w-0 space-y-5 rounded-xl border bg-card p-5 sm:p-6">
    <PageHeader title={r.reference} context={<Status status={r.status} />} description={`${r.snapshot.studentName} · ${r.snapshot.studentNumber}`} actions={<>
      {r.status === 'confirmed' && (!staff || admin) && <Button disabled={fileBusy} onClick={() => download(`/dropping-requests/${id}/acknowledgment`, `${r.reference}-acknowledgment.html`)}><DownloadIcon />Download approval</Button>}
    </>} />
    <ErrorText error={mutation.error || fileError} />
    <div className="grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
      <div><p className="text-muted-foreground">Enrollment</p><p className="mt-1 font-medium">SY {r.snapshot.schoolYear} · {r.snapshot.program.toUpperCase()} · {r.snapshot.yearLevel.replaceAll('_', ' ')}</p></div>
      <div><p className="text-muted-foreground">Current balance</p><p className="mt-1 font-semibold tabular-nums">{formatPeso(r.balance)}</p>{r.billId && <Link className="text-primary underline underline-offset-4" to={staff ? `/admin/billing/${r.billId}` : `/portal/bills/${r.billId}`}>View bill</Link>}</div>

    </div>
    {r.status === 'confirmed' ? <div className="bg-muted rounded-lg p-4 text-sm"><p className="font-semibold">Officially dropped effective {dateLabel(r.effectiveDate!)}</p><p className="mt-1 whitespace-pre-wrap">{r.finalRemarks}</p><p className="mt-2">Your records and account remain available. Outstanding balances remain payable; returning next school year requires a new enrollment.</p></div> : null}
    {(r.status === 'needs_correction' || r.status === 'rejected') && lastNote && <div role="status" className="bg-muted rounded-lg p-4 text-sm"><p className="font-semibold">{r.status === 'needs_correction' ? 'Please update your documents' : 'Request rejected'}</p><p className="mt-1 whitespace-pre-wrap">{lastNote.remarks}</p></div>}

    {reviewable && !staff && <p className="bg-muted rounded-lg p-4 text-sm">Your request is waiting for approval. We’ll notify you when there’s an update.</p>}
    <RequestAssessment requestId={r.id} final={r.droppingAssessment} current={r.financialSummary} staff={staff} billId={r.billId} active={openStatuses.includes(r.status)} />
    {admin && reviewable && <CategoryEditor request={r} />}
    {documents}
    {admin && reviewable && <FinalDecision requestId={r.id} key={`${r.id}-${r.packetVersion}`} busy={mutation.isPending} onDecision={(action, payload) => mutation.mutateAsync({ action, payload: { ...payload, version: r.packetVersion } })} />}
    {editable && <UploadDocuments key={r.submissions.length} request={r} busy={mutation.isPending} onSubmit={payload => mutation.mutate({ action: 'submit', payload })}
      formDownload={<Button type="button" variant="outline" size="sm" disabled={fileBusy} onClick={() => download('/dropping-requests/form', 'official-dropping-form.pdf')}><DownloadIcon />Official form</Button>}
      onCancel={() => setConfirmAction({ action: 'cancel', payload: {}, title: 'Cancel this dropping request?', description: 'Your enrollment and bills will stay unchanged. This request and its submitted documents will remain in history.' })} />}
    {!staff && r.status === 'submitted' && <div className="border-t pt-4"><Button variant="ghost" disabled={mutation.isPending} onClick={() => setConfirmAction({ action: 'cancel', payload: {}, title: 'Cancel this dropping request?', description: 'Your enrollment and bills will stay unchanged. Your submitted documents will remain in history.' })}>Cancel request</Button></div>}

    </div>
    {r.events.length > 0 && <aside className="min-w-0 space-y-6 rounded-xl border bg-card p-5 sm:p-6">
      {editable && <section className="space-y-3 border-b pb-5"><h2 className="font-semibold">Before you submit</h2><ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground"><li>Complete the official form in three copies and collect all applicable signatures.</li><li>Attach your reason letter and confirmation / enrolled-subjects form.</li><li>Upload clear copies of all pages and keep the originals.</li></ul></section>}
      {history}
    </aside>}
    </div>
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent aria-describedby={undefined} className="max-h-[90dvh] w-[calc(100%-2rem)] sm:max-w-4xl"><DialogHeader><DialogTitle className="break-all pr-6">{preview?.name}</DialogTitle></DialogHeader>{preview?.mime === 'application/pdf' ? <Suspense fallback={<p role="status">Loading PDF…</p>}><PdfPreview url={preview.url} name={preview.name} /></Suspense> : preview && <img alt={preview.name} src={preview.url} className="max-h-[65dvh] w-full object-contain" />}</DialogContent></Dialog>
    <Dialog open={!!confirmAction} onOpenChange={open => { if (!open && !mutation.isPending) setConfirmAction(null); }}><DialogContent showCloseButton={!mutation.isPending} className="w-[calc(100%-2rem)]"><DialogHeader><DialogTitle>{confirmAction?.title}</DialogTitle></DialogHeader><p className="text-muted-foreground text-sm">{confirmAction?.description}</p><ErrorText error={mutation.error} /><div className="flex justify-end gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirmAction(null)}>Go back</Button><Button disabled={mutation.isPending} onClick={() => confirmAction && mutation.mutate(confirmAction)}>{mutation.isPending ? 'Saving…' : 'Confirm'}</Button></div></DialogContent></Dialog>
  </div>;
}

function UploadDocuments({ request, busy, onSubmit, formDownload, onCancel }: { request: DroppingRequest; busy: boolean; onSubmit: (payload: FormData) => void; formDownload: ReactNode; onCancel: () => void }) {
  const [reason, setReason] = useState(request.reason ?? '');
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
  return <form className="space-y-5 border-t pt-5" onSubmit={event => { event.preventDefault(); const data = new FormData(); data.append('reason', reason); files.forEach(file => data.append('files[]', file)); onSubmit(data); }}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{request.status === 'needs_correction' ? 'Update documents' : 'Documents'}</h2>{formDownload}</div>
    <div className="space-y-2"><Label htmlFor="drop-reason">Reason for dropping</Label><Textarea id="drop-reason" required maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /><p className="text-muted-foreground text-xs">Briefly explain why you are requesting to drop.</p></div>
    <div className="space-y-2"><Label htmlFor="drop-files">Signed form and supporting attachments</Label><Input id="drop-files" type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={busy} onChange={e => selectFiles(Array.from(e.target.files ?? []))} /><p className="text-muted-foreground text-xs">PDF, JPG or PNG · Up to 12 files · 2 MB each · 7 MB total.</p></div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {previews.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{previews.map((p, i) => <div key={i} className="min-w-0 space-y-2"><p className="break-all text-sm font-medium">{p.file.name}</p>{p.file.type === 'application/pdf' ? <Suspense fallback={<p role="status">Loading PDF…</p>}><PdfPreview url={p.url} name={p.file.name} className="h-80" /></Suspense> : <img src={p.url} alt={`Preview ${p.file.name}`} className="h-64 w-full rounded-md border object-contain" />}<a href={p.url} target="_blank" rel="noreferrer" className="text-primary text-sm underline underline-offset-4">Open full preview</a></div>)}</div>}
    <label className="flex items-start gap-3 text-sm"><Checkbox checked={checked} onCheckedChange={value => setChecked(value === true)} disabled={busy || files.length === 0} className="mt-0.5" /><span>I have reviewed every page and included the complete signed form and supporting attachments.</span></label>
    <div className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">Your enrollment ends only after approval. Unpaid bills remain payable.</p><div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={onCancel}>Cancel request</Button><Button type="submit" disabled={busy || !checked || files.length === 0 || !reason.trim()}>{busy ? 'Uploading documents…' : 'Submit request'}</Button></div></div>
  </form>;
}

function FinalDecision({ requestId, busy, onDecision }: { requestId: number; busy: boolean; onDecision: (action: string, payload: Record<string, unknown>) => Promise<unknown> }) {
  const [decision, setDecision] = useState('');
  const [remarks, setRemarks] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [error, setError] = useState<unknown>(null);
  const confirming = decision === 'confirm';
  const assessment = useQuery({ queryKey: ['dropping-assessment', requestId, effectiveDate], queryFn: () => fetchAssessment(requestId, effectiveDate), enabled: confirming && !!effectiveDate, staleTime: 0 });
  const title = confirming ? 'Approve drop' : decision === 'needs_correction' ? 'Return for correction' : 'Reject request';
  const open = (action: string) => { setRemarks(''); setEffectiveDate(''); setError(null); setDecision(action); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || (confirming && (assessment.isFetching || assessment.isError || !assessment.data?.ready || !assessment.data.fingerprint))) return;
    setError(null);
    try {
      await onDecision(confirming ? 'confirm' : 'decision', confirming ? { effectiveDate, remarks, assessmentFingerprint: assessment.data?.fingerprint } : { outcome: decision, remarks });
      setDecision('');
    } catch (failure) { setError(failure); if (confirming) void assessment.refetch(); }
  };
  return <section className="space-y-3 border-t pt-5" aria-label="Request actions">
    <ul className="flex flex-wrap gap-2">
      <li><Button disabled={busy} onClick={() => open('confirm')}>Approve drop</Button></li>
      <li><Button variant="outline" disabled={busy} onClick={() => open('needs_correction')}>Return for correction</Button></li>
      <li><Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => open('rejected')}>Reject request</Button></li>
    </ul>
    <Dialog open={!!decision} onOpenChange={isOpen => { if (!isOpen && !busy) setDecision(''); }}>
      <DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-sm text-muted-foreground">{confirming ? 'Review the charge for the effective date before approving. Verified payments are kept, and any excess becomes student credit.' : decision === 'needs_correction' ? 'Tell the student what to update before submitting again.' : 'Tell the student why this request cannot be approved. Enrollment stays unchanged.'}</p>
          {confirming && <div className="space-y-2"><Label htmlFor="effective-date">Effective date</Label><Input id="effective-date" type="date" max={philippinesToday()} required value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} disabled={busy} /><p className="text-xs text-muted-foreground">Between enrollment and today.</p></div>}
          {confirming && effectiveDate && <div className="rounded-lg bg-muted/40 p-4">{assessment.isFetching ? <p role="status" className="text-sm">Calculating charge…</p> : assessment.isError ? <div className="space-y-2"><ErrorText error={assessment.error} /><Button type="button" variant="outline" size="sm" onClick={() => assessment.refetch()}>Try again</Button></div> : assessment.data && <AssessmentSummary assessment={assessment.data} staff />}</div>}
          <div className="space-y-2"><Label htmlFor="decision-remarks">{confirming ? 'Notes (optional)' : decision === 'needs_correction' ? 'What needs correcting?' : 'Reason for rejection'}</Label><Textarea id="decision-remarks" required={!confirming} maxLength={2000} value={remarks} onChange={e => setRemarks(e.target.value)} disabled={busy} /></div>
          <ErrorText error={error} />
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setDecision('')}>Cancel</Button><Button type="submit" variant={decision === 'rejected' ? 'destructive' : 'default'} disabled={busy || (confirming ? !effectiveDate || assessment.isFetching || assessment.isError || !assessment.data?.ready || !assessment.data.fingerprint : !remarks.trim())}>{busy ? 'Saving…' : title}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}

function CategoryEditor({ request }: { request: DroppingRequest }) {
  const cache = useQueryClient();
  const save = useMutation({ mutationFn: (category: DroppingCategory) => saveCategory(request.enrollmentId, category), onSuccess: () => { void cache.invalidateQueries({ queryKey: ['dropping'] }); void cache.invalidateQueries({ queryKey: ['dropping-assessment'] }); } });
  return <div className="space-y-2"><Label htmlFor="dropping-category">Fee policy category</Label><Select value={request.droppingCategory ?? ''} disabled={save.isPending} onValueChange={value => save.mutate(value as DroppingCategory)}><SelectTrigger id="dropping-category" className="w-full sm:max-w-xs"><SelectValue placeholder="Confirm the student's category" /></SelectTrigger><SelectContent><SelectItem value="paying">Paying</SelectItem><SelectItem value="voucher_esc">Voucher / ESC</SelectItem></SelectContent></Select><ErrorText error={save.error} /></div>;
}
