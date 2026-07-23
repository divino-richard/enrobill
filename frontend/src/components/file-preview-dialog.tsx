import { Loader2Icon, RefreshCwIcon, UploadIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format-bytes";

// A file the user picked but hasn't committed yet. The caller creates `url` with
// URL.createObjectURL and revokes it when done, so the preview never leaks.
export interface PendingFile {
  file: File;
  url: string;
}

interface FilePreviewDialogProps {
  // The file awaiting confirmation; null closes the dialog.
  pending: PendingFile | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  // Reopens the file picker so a wrong file can be swapped without cancelling.
  onChooseAnother: () => void;
  isUploading: boolean;
  // 0-100 while uploading.
  progress?: number;
  error?: string | null;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

/**
 * Shows a locally selected file before it is uploaded, so the user can confirm
 * they picked the right one. Renders images inline and PDFs in an iframe, both
 * straight from the object URL — nothing is sent anywhere until Upload is
 * clicked.
 */
export function FilePreviewDialog({
  pending,
  onOpenChange,
  onConfirm,
  onChooseAnother,
  isUploading,
  progress = 0,
  error,
  title = "Check before uploading",
  description = "Make sure this is the right file and that it's readable.",
  confirmLabel = "Upload this file",
}: FilePreviewDialogProps) {
  const isImage = pending?.file.type.startsWith("image/") ?? false;

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(next) => {
        // An upload in flight shouldn't be interrupted by a stray click-away.
        if (isUploading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 flex h-[60vh] items-center justify-center overflow-hidden rounded-md border">
          {pending === null ? null : isImage ? (
            <img
              src={pending.url}
              alt={pending.file.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <iframe
              src={pending.url}
              title={pending.file.name}
              className="h-full w-full"
            />
          )}
        </div>

        {pending && (
          <p className="text-muted-foreground truncate text-sm">
            <span className="text-foreground font-medium">
              {pending.file.name}
            </span>{" "}
            · {formatBytes(pending.file.size)}
          </p>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={onChooseAnother}
            disabled={isUploading}
            className="text-muted-foreground"
          >
            <RefreshCwIcon />
            Choose another file
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={isUploading}>
              {isUploading ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <UploadIcon />
              )}
              {isUploading ? `Uploading… ${progress}%` : confirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
