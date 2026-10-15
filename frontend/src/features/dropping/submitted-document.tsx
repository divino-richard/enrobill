import { useRef, useState } from 'react';
import { EyeIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/get-error-message';
import type { DroppingRequest } from './api';

type SubmittedFile = DroppingRequest['submissions'][number]['files'][number];
export function SubmittedDocument({ file, onPreview }: {
  file: SubmittedFile;
  onPreview: (file: SubmittedFile, trigger: HTMLButtonElement | null) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const running = useRef(false);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const size = file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`;

  async function openPreview() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setFailure(null);
    try {
      await onPreview(file, previewTrigger.current);
    } catch (error) {
      setFailure(getErrorMessage(error));
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return <li className="space-y-2 rounded-lg border p-3">
    <div className="flex flex-wrap items-center gap-3">
      <FileTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{file.name}</p>
        <p role="status" aria-atomic="true" className="mt-1 min-h-4 text-xs text-muted-foreground">
          {pending ? 'Opening preview…' : `${file.mime === 'application/pdf' ? 'PDF' : 'Image'} · ${size}`}
        </p>
      </div>
      <Button ref={previewTrigger} size="sm" className="ml-auto" variant="outline" disabled={pending} aria-busy={pending} onClick={() => void openPreview()} aria-label={`Preview ${file.name}`}>
        {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}Preview
      </Button>
    </div>
    {failure && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8">
      <p role="alert" className="min-w-0 flex-1 basis-48 break-words text-xs leading-relaxed text-destructive">Preview failed. {failure}</p>
      <Button variant="ghost" size="sm" onClick={() => void openPreview()} aria-label={`Retry preview for ${file.name}`}>Try again</Button>
    </div>}
  </li>;
}
