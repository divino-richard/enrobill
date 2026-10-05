import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, MinusIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

GlobalWorkerOptions.workerSrc = workerUrl;

// Keep private documents local; do not depend on the browser's PDF plug-in.
export default function PdfPreview(props: { url: string; name: string; className?: string }) {
  return <PdfDocument key={props.url} {...props} />;
}
function PdfDocument({ url, name, className = 'h-[65dvh]' }: { url: string; name: string; className?: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    let active = true;
    const task = getDocument({ url });
    task.promise.then(pdf => { if (active) setDocument(pdf); }).catch(() => { if (active) setError(true); });
    return () => { active = false; void task.destroy(); };
  }, [url]);
  return <div className={`flex min-h-0 flex-col overflow-hidden rounded-lg border ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background p-2">
      <div className="flex items-center gap-1">
        <Button type="button" size="icon" variant="ghost" aria-label="Previous PDF page" disabled={!document || page === 1} onClick={() => setPage(page - 1)}><ChevronLeftIcon /></Button>
        <span className="text-xs tabular-nums" role="status">Page {page} of {document?.numPages ?? '…'}</span>
        <Button type="button" size="icon" variant="ghost" aria-label="Next PDF page" disabled={!document || page === document.numPages} onClick={() => setPage(page + 1)}><ChevronRightIcon /></Button>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" size="icon" variant="ghost" aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom(zoom - 0.25)}><MinusIcon /></Button>
        <span className="text-xs tabular-nums">{zoom * 100}%</span>
        <Button type="button" size="icon" variant="ghost" aria-label="Zoom in" disabled={zoom === 2} onClick={() => setZoom(zoom + 0.25)}><PlusIcon /></Button>
        <a href={url} download={name} className="text-primary px-2 text-xs underline underline-offset-4">Download</a>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-auto bg-muted p-3" tabIndex={0} aria-label="PDF pages">
      {error ? <p role="alert" className="p-4 text-sm">This PDF could not be displayed. Download it to view the original file.</p> : document ? <div style={{ width: `${zoom * 100}%` }}><PdfPage key={page} document={document} page={page} name={name} /></div> : <Loading />}
    </div>
  </div>;
}
function Loading() {
  return <p role="status" className="flex items-center justify-center gap-2 p-6 text-sm"><Loader2Icon className="size-4 animate-spin" />Loading PDF…</p>;
}
function PdfPage({ document, page, name }: { document: PDFDocumentProxy; page: number; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    let render: RenderTask | undefined;
    void (async () => {
      try {
        const pdfPage = await document.getPage(page);
        if (!active || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: 1800 / base.width });
        const target = canvas.current;
        target.width = viewport.width;
        target.height = viewport.height;
        render = pdfPage.render({ canvas: target, viewport });
        await render.promise;
        if (active) setStatus('ready');
      } catch { if (active) setStatus('error'); }
    })();
    return () => { active = false; render?.cancel(); };
  }, [document, page]);
  return <>
    {status === 'loading' && <Loading />}
    {status === 'error' && <p role="alert" className="p-4 text-sm">This page could not be displayed. Download the PDF to view it.</p>}
    <canvas ref={canvas} role="img" aria-label={`${name}, page ${page}`} className={`h-auto w-full bg-white shadow-sm ${status === 'ready' ? '' : 'hidden'}`} />
  </>;
}
