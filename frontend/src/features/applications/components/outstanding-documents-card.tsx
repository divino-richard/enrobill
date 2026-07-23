import { useRef, useState } from "react";
import { CalendarClockIcon, FileText, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FilePreviewDialog,
  type PendingFile,
} from "@/components/file-preview-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatDate } from "../utils";
import { useSubmitOutstandingDocument } from "../hooks/use-applications";
import {
  ACCEPTED_DOCUMENT_ACCEPT,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  APPLICATION_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  OPTIONAL_DOCUMENT_TYPES,
  type ApplicationDocumentType,
  type UploadedDocument,
} from "../documents";

function OutstandingRow({
  applicationId,
  type,
  label,
}: {
  applicationId: number;
  type: ApplicationDocumentType;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmitOutstandingDocument(applicationId);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Picked but not yet sent — reviewed in the preview first.
  const [pending, setPending] = useState<PendingFile | null>(null);

  function clearPending() {
    setPending((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  // Validates the pick and stages it for review; nothing is uploaded yet.
  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (
      !ACCEPTED_DOCUMENT_MIME_TYPES.includes(
        file.type as (typeof ACCEPTED_DOCUMENT_MIME_TYPES)[number],
      )
    ) {
      setError("Only JPG, PNG, or PDF files are allowed.");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError("File is too large (max 10 MB).");
      return;
    }

    setPending((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { file, url: URL.createObjectURL(file) };
    });
  }

  async function confirmUpload() {
    if (!pending) return;
    setError(null);
    setProgress(0);
    try {
      await submit.mutateAsync({
        type,
        file: pending.file,
        onProgress: setProgress,
      });
      clearPending();
    } catch (err) {
      // Kept open so the student can retry.
      setError(getErrorMessage(err));
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null || submit.isPending;

  return (
    <div className="rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
            <FileText className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            <p className="text-muted-foreground text-xs">
              JPG, PNG or PDF · max 10 MB
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {progress ?? 0}%
            </>
          ) : (
            <>
              <UploadCloud className="size-4" />
              Upload
            </>
          )}
        </Button>
      </div>

      {/* Validation errors sit on the row; upload failures show in the preview,
          which stays open so the student can retry. */}
      {error && !pending && (
        <p className="text-destructive mt-2 text-xs">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <FilePreviewDialog
        pending={pending}
        onOpenChange={(open) => {
          if (!open) clearPending();
        }}
        onConfirm={() => void confirmUpload()}
        onChooseAnother={() => inputRef.current?.click()}
        isUploading={busy}
        progress={progress ?? 0}
        error={error}
        title={`Upload ${label}`}
        description="Check the document is complete and readable before submitting it to the registrar."
      />
    </div>
  );
}

/**
 * The supporting documents a student committed to submitting later. Renders
 * nothing once everything promised has been handed in.
 */
export function OutstandingDocumentsCard({
  applicationId,
  documents,
  promissoryDate,
}: {
  applicationId: number;
  documents: UploadedDocument[];
  promissoryDate?: string | null;
}) {
  const uploaded = new Set(documents.map((doc) => doc.type));
  const outstanding = APPLICATION_DOCUMENT_TYPES.filter(
    (doc) =>
      OPTIONAL_DOCUMENT_TYPES.includes(doc.value) && !uploaded.has(doc.value),
  );

  if (outstanding.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents still to submit</CardTitle>
        <CardDescription>
          You committed to providing these when you applied. Upload them here —
          no need to visit the registrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {promissoryDate && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CalendarClockIcon className="size-3.5 shrink-0" />
            You estimated {formatDate(promissoryDate)}.
          </p>
        )}
        {outstanding.map((doc) => (
          <OutstandingRow
            key={doc.value}
            applicationId={applicationId}
            type={doc.value}
            label={doc.label}
          />
        ))}
      </CardContent>
    </Card>
  );
}
