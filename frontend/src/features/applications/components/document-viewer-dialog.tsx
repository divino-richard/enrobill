import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDocumentViewUrl } from "../documents-api";
import type { UploadedDocument } from "../documents";

interface DocumentViewerDialogProps {
  applicationId: number;
  // The document to preview; null closes the dialog.
  document: UploadedDocument | null;
  onOpenChange: (open: boolean) => void;
}

// Previews an uploaded verification document in a modal. Fetches a short-lived
// pre-signed URL and renders the file inline (image or PDF via an iframe).
export function DocumentViewerDialog({
  applicationId,
  document,
  onOpenChange,
}: DocumentViewerDialogProps) {
  const open = document !== null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["applications", applicationId, "documents", document?.id, "url"],
    queryFn: () => fetchDocumentViewUrl(applicationId, document!.id!),
    enabled: open && document?.id != null,
    // Pre-signed URLs are valid for ~10 min; don't refetch within that window.
    staleTime: 5 * 60 * 1000,
  });

  const isImage = (document?.contentType ?? "").startsWith("image/");

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
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={data.url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                Open in new tab
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
