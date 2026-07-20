import { useRef, useState } from "react";
import {
  CheckCircle2Icon,
  EyeIcon,
  FileTextIcon,
  InfoIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import { fetchStudentDocumentBlob, fetchStudentDocumentViewUrl } from "../api";
import { useMyDocuments, useUploadMyDocument } from "../hooks";
import {
  ACCEPT_ATTR,
  ACCEPTED_MIME,
  DOCUMENT_TYPES,
  MAX_BYTES,
  SEMESTERS,
  type Semester,
  type StudentDocument,
  type StudentDocumentType,
} from "../types";

// Every slot a student is expected to fill across the school year.
export const TOTAL_DOCUMENT_SLOTS = SEMESTERS.length * DOCUMENT_TYPES.length;

function formatSize(bytes: number | null) {
  if (bytes == null) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(Math.round(bytes / 1024), 1)} KB`;
}

// One upload slot: a semester's clearance or grade slip. Re-uploading replaces
// whatever is already there.
function DocumentSlot({
  semester,
  type,
  label,
  hint,
  existing,
  onView,
}: {
  semester: Semester;
  type: StudentDocumentType;
  label: string;
  hint: string;
  existing?: StudentDocument;
  onView: (document: StudentDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMyDocument();
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLocalError(null);

    if (!ACCEPTED_MIME.includes(file.type)) {
      setLocalError("Upload a JPG, PNG or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("File is larger than 10 MB.");
      return;
    }

    setProgress(0);
    try {
      await upload.mutateAsync({ semester, type, file, onProgress: setProgress });
    } catch {
      // Surfaced below via upload.isError.
    }
  }

  const busy = upload.isPending;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        existing
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="text-sm font-medium">{label}</span>
            {existing ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              >
                <CheckCircle2Icon className="size-3" />
                Uploaded
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not uploaded
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {existing
              ? `${existing.fileName}${existing.size ? ` · ${formatSize(existing.size)}` : ""}${
                  existing.uploadedAt
                    ? ` · ${format(new Date(existing.uploadedAt), "MMM d, yyyy")}`
                    : ""
                }`
              : hint}
          </p>
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
          <Button
            variant={existing ? "outline" : "default"}
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            {busy ? "Uploading…" : existing ? "Replace" : "Upload"}
          </Button>
        </div>
      </div>

      {(localError || upload.isError) && (
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
          void handleFile(event.target.files?.[0]);
          // Reset so picking the same file again still fires a change.
          event.target.value = "";
        }}
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  const find = (semester: Semester, type: StudentDocumentType) =>
    documents?.find((d) => d.semester === semester && d.type === type);

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon className="size-4 shrink-0" />
        <AlertTitle>
          {documents?.length ?? 0} of {TOTAL_DOCUMENT_SLOTS} uploaded
        </AlertTitle>
        <AlertDescription>
          The registrar reads these at the end of the school year to decide
          whether you move up a grade level. JPG, PNG or PDF, up to 10 MB each —
          you can replace a file any time before the evaluation.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {SEMESTERS.map((semester) => (
          <Card key={semester.value}>
            <CardHeader className="border-b">
              <CardTitle className="text-base">{semester.label}</CardTitle>
              <CardDescription>
                Clearance and grades for this semester.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {DOCUMENT_TYPES.map((type) => (
                <DocumentSlot
                  key={type.value}
                  semester={semester.value}
                  type={type.value}
                  label={type.label}
                  hint={type.hint}
                  existing={find(semester.value, type.value)}
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
