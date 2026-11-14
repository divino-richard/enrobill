import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { FileTextIcon, FolderOpenIcon, UploadCloudIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes } from '@/lib/format-bytes';
import { cn } from '@/lib/utils';
import type { DroppingRequest, DroppingSubmission } from './api';
import { getDroppingSubmissionError } from './submission-error';

const PdfPreview = lazy(() => import('@/components/pdf-preview'));

function ErrorText({ error }: { error: unknown }) {
  return error ? <p role="alert" className="text-destructive text-sm">{getDroppingSubmissionError(error)}</p> : null;
}

export function DroppingSubmissionForm({ request, busy, onSubmit, onCancel, error: submissionError }: { request?: DroppingRequest; busy: boolean; onSubmit: (payload: DroppingSubmission) => Promise<unknown>; onCancel?: () => void; error?: unknown }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [reason, setReason] = useState(request?.reason ?? '');
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const files = previews.map(p => p.file);
  const selectedPreview = previews[previewIndex];
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews]);
  function selectFiles(next: File[]) {
    setChecked(false); setError(''); setPreviewOpen(false); setPreviewIndex(0);
    if (next.some(file => file.size === 0)) {
      setPreviews([]); setError('One of the selected documents is empty. Choose a file that contains your signed form or attachment.'); return;
    }
    if (next.length > 12 || next.some(f => f.size > 2 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) || next.reduce((s, f) => s + f.size, 0) > 7 * 1024 * 1024) {
      setPreviews([]); setError('Choose up to 12 PDF, JPG, or PNG files, each up to 2 MB and 7 MB total.'); return;
    }
    setPreviews(next.map(file => ({ file, url: URL.createObjectURL(file) })));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current || !checked || !files.length || !reason.trim()) return;
    submitting.current = true;
    try {
      await onSubmit({ reason, files });
    } catch {
      // The mutation supplies the error to the alert below and leaves the form available to retry.
    } finally {
      submitting.current = false;
    }
  }
  return <form className={request ? "space-y-5 border-t pt-5" : "space-y-5"} onSubmit={submit}>
    {request && <h2 className="text-base font-semibold">{request.status === 'needs_correction' ? 'Update documents' : 'Documents'}</h2>}
    <div className="space-y-2"><Label htmlFor="drop-reason">Reason for dropping</Label><Textarea id="drop-reason" required maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div>
    <div className="space-y-2">
      <Label id="drop-files-label" htmlFor="drop-files">Signed form and attachments</Label>
      <div role="group" aria-labelledby="drop-files-label" className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors', files.length ? 'border-primary/40 bg-primary/5' : 'border-dashed')}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', files.length ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <FileTextIcon className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0" role="status">
            <p className="truncate text-sm font-medium" title={files.length === 1 ? files[0].name : undefined}>{files.length === 1 ? files[0].name : files.length ? `${files.length} files selected` : 'Upload documents'}</p>
            <p className="text-muted-foreground text-xs">{files.length ? formatBytes(files.reduce((total, file) => total + file.size, 0)) : 'PDF, JPG or PNG'}</p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
        {selectedPreview && <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="h-9 shrink-0" aria-label={files.length === 1 ? `Open ${selectedPreview.file.name}` : `Open ${files.length} selected documents`}><FolderOpenIcon aria-hidden="true" />Open</Button></DialogTrigger>
          <DialogContent aria-describedby={undefined} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-4xl [&>[data-slot=dialog-close]]:size-11">
            <DialogHeader><DialogTitle className="break-all pr-10">{selectedPreview.file.name}</DialogTitle></DialogHeader>
            {previews.length > 1 && <Select value={String(previewIndex)} onValueChange={value => setPreviewIndex(Number(value))}>
              <SelectTrigger className="w-full min-w-0 [&_[data-slot=select-value]]:truncate" aria-label="Document to open"><SelectValue /></SelectTrigger>
              <SelectContent>{previews.map((preview, index) => <SelectItem key={index} value={String(index)} className="break-all">{preview.file.name}</SelectItem>)}</SelectContent>
            </Select>}
            {selectedPreview.file.type === 'application/pdf'
              ? <Suspense fallback={<p role="status">Loading PDF…</p>}><PdfPreview url={selectedPreview.url} name={selectedPreview.file.name} /></Suspense>
              : <img src={selectedPreview.url} alt={selectedPreview.file.name} className="max-h-[65dvh] w-full object-contain" />}
          </DialogContent>
        </Dialog>}
          <Button type="button" variant={files.length ? 'ghost' : 'outline'} size={files.length ? 'icon-sm' : 'sm'} className={cn('h-9 shrink-0', files.length && 'w-9 text-muted-foreground hover:text-destructive')} disabled={busy} aria-label={files.length ? 'Remove selected documents' : 'Upload signed form and attachments'} aria-describedby="drop-files-help" onClick={() => files.length ? selectFiles([]) : fileInput.current?.click()}>
            {files.length ? <XIcon aria-hidden="true" /> : <><UploadCloudIcon aria-hidden="true" />Upload</>}
          </Button>
        </div>
        <input ref={fileInput} id="drop-files" className="hidden" type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={busy} onChange={event => {
          const next = Array.from(event.target.files ?? []);
          if (next.length) selectFiles(next);
          event.target.value = '';
        }} />
      </div>
      <p id="drop-files-help" className="text-muted-foreground text-xs">Up to 12 files · 2 MB each · 7 MB total.</p>
    </div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <label className="flex items-start gap-3 text-sm"><Checkbox checked={checked} onCheckedChange={value => setChecked(value === true)} disabled={busy || files.length === 0} className="mt-0.5" /><span>I reviewed my complete, signed documents.</span></label>
    <ErrorText error={submissionError} />
    <div className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">Your enrollment stays active until approval.</p><div className="flex flex-wrap items-center justify-end gap-3"><>{onCancel && <Button type="button" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={onCancel}>{request ? 'Cancel request' : 'Cancel'}</Button>}</><Button type="submit" disabled={busy || !checked || files.length === 0 || !reason.trim()}>{busy ? 'Uploading documents…' : 'Submit request'}</Button></div></div>
  </form>;
}
