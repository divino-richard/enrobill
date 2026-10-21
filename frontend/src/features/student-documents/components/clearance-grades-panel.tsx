import { useRef, useState } from "react";
import {
  CheckCircle2Icon,
  EyeIcon,
  FileTextIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentViewerDialog } from "@/components/document-viewer-dialog";
import {
  FilePreviewDialog,
  type PendingFile,
} from "@/components/file-preview-dialog";
import { formatBytes } from "@/lib/format-bytes";
import { getErrorMessage } from "@/lib/get-error-message";
import { fetchStudentDocumentBlob, fetchStudentDocumentViewUrl } from "../api";
import { useMyDocuments, useUploadMyDocument } from "../hooks";
import {
  ACCEPT_ATTR,
  ACCEPTED_MIME,
  DOCUMENT_TYPES,
  MAX_BYTES,
  REVIEW_STATUS_META,
  SEMESTERS,
  type Semester,
  type StudentDocument,
  type StudentDocumentType,
} from "../types";

// Every slot a student is expected to fill across the school year.
export const TOTAL_DOCUMENT_SLOTS = SEMESTERS.length * DOCUMENT_TYPES.length;

function DocumentFileDetails({ document }: { document: StudentDocument }) {
  const extensionIndex = document.fileName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;
  const name = Array.from(hasExtension ? document.fileName.slice(0, extensionIndex) : document.fileName);
  const prefix = name.slice(0, -8).join("");
  const suffix = name.slice(-8).join("") + (hasExtension ? document.fileName.slice(extensionIndex) : "");

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <span className="flex min-w-0 max-w-full flex-[1_1_8rem]" title={document.fileName}>
        <span className="sr-only">{document.fileName}</span>
        <span className="truncate" aria-hidden="true">{prefix}</span>
        <span className="shrink-0" aria-hidden="true">{suffix}</span>
      </span>
      {(document.size != null || document.uploadedAt) && (
        <span className="flex max-w-full flex-wrap items-baseline gap-x-1.5">
          {document.size != null && (
            <span className="whitespace-nowrap">{document.size === 0 ? "0 B" : formatBytes(document.size)}</span>
          )}
          {document.uploadedAt && (
            <span className="whitespace-nowrap">
              {document.size != null && <span className="mr-1.5" aria-hidden="true">·</span>}
              <time dateTime={document.uploadedAt}>{format(new Date(document.uploadedAt), "MMM d, yyyy")}</time>
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// One upload slot: a semester's clearance or grade slip. Re-uploading replaces
// whatever is already there.
function DocumentSlot({
  semester,
  semesterLabel,
  type,
  label,
  hint,
  existing,
  uploadable = true,
  onView,
}: {
  semester: Semester;
  semesterLabel: string;
  type: StudentDocumentType;
  label: string;
  hint: string;
  existing?: StudentDocument;
  uploadable?: boolean;
  onView: (document: StudentDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMyDocument();
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  // Picked but not yet sent — the student reviews it in the preview first.
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
    setLocalError(null);
    upload.reset();

    if (!ACCEPTED_MIME.includes(file.type)) {
      setLocalError("Upload a JPG, PNG or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("File is larger than 10 MB.");
      return;
    }

    setPending((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { file, url: URL.createObjectURL(file) };
    });
  }

  async function confirmUpload() {
    if (!pending) return;
    setProgress(0);
    try {
      await upload.mutateAsync({
        semester,
        type,
        file: pending.file,
        onProgress: setProgress,
      });
      clearPending();
    } catch {
      // Kept open so the student can retry — surfaced via upload.isError.
    }
  }

  const busy = upload.isPending;
  // Locked the moment a file exists — only an explicit return unlocks it,
  // whether it's still awaiting review or was already accepted.
  const locked = !uploadable || (existing !== undefined && existing.reviewStatus !== "returned");

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="text-sm font-medium">{label}</span>
            {existing ? (
              <Badge
                variant="outline"
                className={REVIEW_STATUS_META[existing.reviewStatus].className}
              >
                {existing.reviewStatus === "accepted" && (
                  <CheckCircle2Icon className="size-3" />
                )}
                {REVIEW_STATUS_META[existing.reviewStatus].label}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not uploaded
              </Badge>
            )}
          </div>
          {existing ? <DocumentFileDetails document={existing} /> : (
            <p className="text-muted-foreground text-xs">{hint}</p>
          )}
          {existing?.reviewStatus === "returned" && existing.reviewNote && (
            <p className="text-amber-800 dark:text-amber-200 mt-1 text-xs">
              <span className="font-medium">Returned:</span> {existing.reviewNote}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {busy && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {progress}%
            </span>
          )}
          {existing && !busy && (
            <Button variant="outline" size="sm" onClick={() => onView(existing)}>
              <EyeIcon />
              View
            </Button>
          )}
          {!locked && (
            <Button
              variant={existing ? "outline" : "default"}
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              {busy ? "Uploading…" : existing ? "Replace" : "Upload"}
            </Button>
          )}
        </div>
      </div>

      {/* Validation errors belong on the slot; upload failures show in the
          preview dialog, which stays open so the student can retry. */}
      {(localError || (upload.isError && !pending)) && (
        <p className="text-destructive mt-2 text-xs">
          {localError ?? getErrorMessage(upload.error)}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          // Reset so picking the same file again still fires a change.
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
        progress={progress}
        error={upload.isError ? getErrorMessage(upload.error) : null}
        title={existing ? `Replace ${label}` : `Upload ${label}`}
        description={
          existing
            ? `${semesterLabel} · this replaces the file you uploaded before.`
            : `${semesterLabel} · check the page is complete and readable before uploading.`
        }
        confirmLabel={existing ? "Replace file" : "Upload this file"}
      />
    </div>
  );
}

/**
 * The student's clearance and grade slips for the active school year, one card
 * per semester. Lives inside My Program, next to the enrollment context that
 * gives these documents their meaning.
 */
export function ClearanceGradesPanel() {
  const { data: documents, isLoading, isError, refetch } = useMyDocuments();
  // One dialog for all four slots, rather than one mounted per slot.
  const [viewing, setViewing] = useState<StudentDocument | null>(null);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
        <p className="text-muted-foreground text-sm">
          We couldn&apos;t load your documents. Please try again.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  const find = (semester: Semester, type: StudentDocumentType) =>
    documents?.find((d) => d.semester === semester && d.type === type);

  return (
    <div className="space-y-4">
      <section aria-label="Document requirements" className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Clearance &amp; grades</h2>
          <Badge variant="secondary" className="font-medium tabular-nums">
            {documents?.length ?? 0} of {TOTAL_DOCUMENT_SLOTS} on file
          </Badge>
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Upload your clearance each semester. Teachers upload grade slips;
          the registrar reviews both at the end of the school year.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {SEMESTERS.map((semester) => (
          <Card key={semester.value} className="shadow-none [--card-spacing:--spacing(5)]">
            <CardHeader className="border-b">
              <CardTitle className="text-base">{semester.label}</CardTitle>
              <CardDescription>
                Clearance and grades for this semester.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DOCUMENT_TYPES.map((type) => (
                <DocumentSlot
                  key={type.value}
                  semester={semester.value}
                  semesterLabel={semester.label}
                  type={type.value}
                  label={type.label}
                  hint={type.hint}
                  existing={find(semester.value, type.value)}
                  uploadable={type.value === "clearance"}
                  onView={setViewing}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <DocumentViewerDialog
        document={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        queryKey={["student-documents", viewing?.id, "url"]}
        fetchUrl={fetchStudentDocumentViewUrl}
        fetchBlob={fetchStudentDocumentBlob}
      />
    </div>
  );
}
