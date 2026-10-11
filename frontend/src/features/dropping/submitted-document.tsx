import { useRef, useState } from 'react';
import { DownloadIcon, EyeIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/get-error-message';
import type { DroppingRequest } from './api';

type SubmittedFile = DroppingRequest['submissions'][number]['files'][number];
type FileAction = 'preview' | 'download';

export function SubmittedDocument({ file, onPreview, onDownload }: {
  file: SubmittedFile;
  onPreview: (file: SubmittedFile, trigger: HTMLButtonElement | null) => Promise<void>;
  onDownload: () => Promise<void>;
}) {
  const [pending, setPending] = useState<FileAction | null>(null);
  const [failure, setFailure] = useState<{ action: FileAction; message: string } | null>(null);
  const running = useRef(false);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const size = file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`;

  async function run(action: FileAction) {
    if (running.current) return;
    running.current = true;
    setPending(action);
    setFailure(null);
    try {
      if (action === 'preview') await onPreview(file, previewTrigger.current);
      else await onDownload();
    } catch (error) {
      setFailure({ action, message: getErrorMessage(error) });
    } finally {
      running.current = false;
      setPending(null);
    }
  }

  return <li className="space-y-2 py-4">
    <div className="flex flex-wrap items-center gap-3">
      <FileTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{file.name}</p>
        <p role="status" aria-atomic="true" className="mt-1 min-h-4 text-xs text-muted-foreground">
          {pending === 'preview' ? 'Opening preview…' : pending === 'download' ? 'Downloading…' : `${file.mime === 'application/pdf' ? 'PDF' : 'Image'} · ${size}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button ref={previewTrigger} size="sm" className="h-10 gap-1.5 px-3 shadow-none" variant="outline" disabled={!!pending} aria-busy={pending === 'preview'} onClick={() => void run('preview')} aria-label={`Preview ${file.name}`}>
          {pending === 'preview' ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}Preview
        </Button>
        <Button size="icon" className="size-10" variant="ghost" disabled={!!pending} aria-busy={pending === 'download'} onClick={() => void run('download')} aria-label={`Download ${file.name}`} title={`Download ${file.name}`}>
          {pending === 'download' ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <DownloadIcon aria-hidden="true" />}
        </Button>
      </div>
    </div>
    {failure && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8">
      <p role="alert" className="min-w-0 flex-1 basis-48 break-words text-xs leading-relaxed text-destructive">{failure.action === 'preview' ? 'Preview failed.' : 'Download failed.'} {failure.message}</p>
      <Button variant="ghost" size="sm" className="h-10 shrink-0 px-2 text-xs" onClick={() => void run(failure.action)} aria-label={`Retry ${failure.action} for ${file.name}`}>Try again</Button>
    </div>}
  </li>;
}
