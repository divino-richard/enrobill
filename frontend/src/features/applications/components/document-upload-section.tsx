import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldInfo } from "@/components/form/field-info";
import { cn } from "@/lib/utils";
import { FormSection } from "./form-section";
import type { ApplicationFormApi } from "../hooks/form";
import { uploadApplicationDocument } from "../documents-api";
import {
  ACCEPTED_DOCUMENT_ACCEPT,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  APPLICATION_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  MIN_REQUIRED_DOCUMENTS,
  type ApplicationDocumentType,
  type UploadedDocument,
} from "../documents";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentRowProps {
  type: ApplicationDocumentType;
  label: string;
  uploaded: UploadedDocument | undefined;
  onUploaded: (doc: UploadedDocument) => void;
  onRemove: () => void;
}

function DocumentRow({
  type,
  label,
  uploaded,
  onUploaded,
  onRemove,
}: DocumentRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isUploading = progress !== null;

  async function handleFile(file: File | undefined) {
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

    setProgress(0);
    try {
      const doc = await uploadApplicationDocument(type, file, setProgress);
      onUploaded(doc);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        uploaded && "border-primary bg-primary-foreground dark:bg-emerald-950/20",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              uploaded
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {uploaded ? (
              <CheckCircle2 className="size-4.5" />
            ) : (
              <FileText className="size-4.5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            {uploaded ? (
              <p className="text-muted-foreground truncate text-xs">
                {uploaded.fileName} · {formatBytes(uploaded.size)}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                JPG, PNG, or PDF — max 10 MB
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {uploaded ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <X className="size-4" />
              Remove
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {progress}%
                </>
              ) : (
                <>
                  <UploadCloud className="size-4" />
                  Upload
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {isUploading && (
        <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          // Reset so re-selecting the same file fires onChange again.
          e.target.value = "";
        }}
      />
    </div>
  );
}

interface DocumentUploadSectionProps {
  form: ApplicationFormApi;
}

export function DocumentUploadSection({ form }: DocumentUploadSectionProps) {
  return (
    <FormSection
      title="Previous School Verification"
      icon={ShieldCheck}
      description={`Upload at least ${MIN_REQUIRED_DOCUMENTS} of the following documents to verify your records.`}
    >
      <form.Field
        name="documents"
        validators={{
          onChange: ({ value }: { value: UploadedDocument[] }) =>
            value.length >= MIN_REQUIRED_DOCUMENTS
              ? undefined
              : `Please upload at least ${MIN_REQUIRED_DOCUMENTS} documents (${value.length}/${MIN_REQUIRED_DOCUMENTS} uploaded).`,
        }}
      >
        {(field) => {
          const docs = field.state.value;
          const met = docs.length >= MIN_REQUIRED_DOCUMENTS;

          const setDoc = (doc: UploadedDocument) =>
            field.handleChange([
              ...docs.filter((d) => d.type !== doc.type),
              doc,
            ]);
          const removeDoc = (type: ApplicationDocumentType) =>
            field.handleChange(docs.filter((d) => d.type !== type));

          return (
            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-center gap-2 text-xs font-medium",
                  met ? "text-primary dark:text-emerald-500" : "text-muted-foreground",
                )}
              >
                {met && <CheckCircle2 className="size-4" />}
                <span>
                  {docs.length} of {MIN_REQUIRED_DOCUMENTS} required documents
                  uploaded
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {APPLICATION_DOCUMENT_TYPES.map((option) => (
                  <DocumentRow
                    key={option.value}
                    type={option.value}
                    label={option.label}
                    uploaded={docs.find((d) => d.type === option.value)}
                    onUploaded={setDoc}
                    onRemove={() => removeDoc(option.value)}
                  />
                ))}
              </div>

              <FieldInfo field={field} />
            </div>
          );
        }}
      </form.Field>
    </FormSection>
  );
}
