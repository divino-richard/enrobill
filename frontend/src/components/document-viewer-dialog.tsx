import { useState, type ComponentProps } from "react";
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
    <DocumentPreviewDialog
      document={document ? {
        fileName: data?.fileName ?? document.fileName,
        contentType: data?.contentType ?? document.contentType,
        url: data?.url,
      } : null}
      onOpenChange={onOpenChange}
      isLoading={isLoading}
      isError={isError}
      onDownload={handleDownload}
      isDownloading={pending === "download"}
      downloadError={actionError}
    />
  );
}

interface DocumentPreviewDialogProps {
  document: { fileName: string; contentType: string | null; url?: string } | null;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  isError?: boolean;
  onDownload: () => void;
  isDownloading?: boolean;
  downloadError?: string | null;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"];
}

// Shared admission-style preview for signed URLs and authenticated blob URLs.
export function DocumentPreviewDialog({
  document,
  onOpenChange,
  isLoading = false,
  isError = false,
  onDownload,
  isDownloading = false,
  downloadError,
  onCloseAutoFocus,
}: DocumentPreviewDialogProps) {
  const isImage = (document?.contentType ?? "").startsWith("image/");
  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto" aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {document?.fileName ?? "Document"}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/40 flex h-[70vh] items-center justify-center overflow-hidden rounded-md border">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : isError || !document?.url ? (
            <p role="alert" className="text-muted-foreground text-sm">
              We couldn't load this document. Please try again.
            </p>
          ) : isImage ? (
            <img
              src={document.url}
              alt={document.fileName}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <iframe
              src={document.url}
              title={document.fileName}
              className="h-full w-full"
            />
          )}
        </div>

        {document?.url && !isError && (
          <div className="flex items-center justify-end gap-2">
            {downloadError && (
              <p role="alert" className="text-destructive mr-auto text-sm">{downloadError}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading}
            >
              <DownloadIcon />
              {isDownloading ? "Downloading…" : "Download"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
