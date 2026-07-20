import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";

type PendingAction = "download" | null;

export interface DocumentViewUrl {
  url: string;
  fileName: string;
  contentType: string | null;
}

// The minimum a viewer needs to know about whatever it is previewing.
export interface ViewableDocument {
  id: number;
  fileName: string;
  contentType: string | null;
}

interface DocumentViewerDialogProps {
  // The document to preview; null closes the dialog.
  document: ViewableDocument | null;
  onOpenChange: (open: boolean) => void;
  // Cache key for the signed-URL lookup, scoped by the caller.
  queryKey: readonly unknown[];
  // Where the signed URL and the raw bytes come from. Kept as props so the same
  // dialog serves application documents and student documents alike.
  fetchUrl: (documentId: number) => Promise<DocumentViewUrl>;
  fetchBlob: (documentId: number) => Promise<Blob>;
}

/**
 * Previews an uploaded document in a modal: fetches a short-lived pre-signed URL
 * and renders the file inline (image, or PDF via an iframe), with download and
 * print driven through a same-origin blob.
 */
export function DocumentViewerDialog({
  document,
  onOpenChange,
  queryKey,
  fetchUrl,
  fetchBlob,
}: DocumentViewerDialogProps) {
  const open = document !== null;
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchUrl(document!.id),
    enabled: open && document?.id != null,
    // Pre-signed URLs are valid for ~10 min; don't refetch within that window.
    staleTime: 5 * 60 * 1000,
  });

  const isImage = (document?.contentType ?? "").startsWith("image/");

  // The view URL is a cross-origin pre-signed S3 link the browser can embed but
  // not read in JS (no CORS for GET), so `download` attributes and iframe
  // printing fail against it. We instead pull the bytes through our own API and
  // drive the action from a same-origin blob URL.
  async function createBlobUrl(): Promise<string | null> {
    if (!document?.id) return null;
    const blob = await fetchBlob(document.id);
    return URL.createObjectURL(blob);
  }

  async function handleDownload() {
    if (!data || pending) return;
    setPending("download");
    setActionError(null);
    try {
      const objectUrl = await createBlobUrl();
      if (!objectUrl) return;
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = data.fileName || "document";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {document?.fileName ?? "Document"}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/40 flex h-[70vh] items-center justify-center overflow-hidden rounded-md border">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : isError || !data ? (
            <p className="text-muted-foreground text-sm">
              We couldn't load this document. Please try again.
            </p>
          ) : isImage ? (
            <img
              src={data.url}
              alt={data.fileName}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <iframe
              src={data.url}
              title={data.fileName}
              className="h-full w-full"
            />
          )}
        </div>

        {data && (
          <div className="flex items-center justify-end gap-2">
            {actionError && (
              <p className="text-destructive mr-auto text-sm">{actionError}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={pending !== null}
            >
              <DownloadIcon />
              {pending === "download" ? "Downloading…" : "Download"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
