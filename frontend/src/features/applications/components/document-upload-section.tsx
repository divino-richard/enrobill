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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/form/date-picker";
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
  REQUIRED_DOCUMENT_TYPES,
  missingOptionalDocuments,
  missingRequiredDocuments,
  type ApplicationDocumentType,
  type UploadedDocument,
} from "../documents";
import { Label } from "@/components/ui/label";
import { FieldLabel } from "@/components/form/field-label";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentRowProps {
  type: ApplicationDocumentType;
  label: string;
  isRequired: boolean;
  uploaded: UploadedDocument | undefined;
  onUploaded: (doc: UploadedDocument) => void;
  onRemove: () => void;
}

function DocumentRow({
  type,
  label,
  isRequired,
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
        uploaded && "border-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              uploaded
                ? "bg-primary-foreground text-primary"
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
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{label}</p>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isRequired
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isRequired ? "Required" : "Optional"}
              </span>
            </div>
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
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <X className="size-4" />
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
  const requiredCount = REQUIRED_DOCUMENT_TYPES.length;
  // Required documents first, so applicants see what's mandatory up top.
  const orderedTypes = [...APPLICATION_DOCUMENT_TYPES].sort(
    (a, b) => Number(b.isRequired) - Number(a.isRequired),
  );

  return (
    <FormSection
      title="Previous School Verification"
      icon={ShieldCheck}
      description="Upload all required documents to verify your records. For any supporting document you can't provide, fill out a promissory note with your estimated date to comply."
    >
      <form.Field
        name="documents"
        validators={{
          onChange: ({ value }: { value: UploadedDocument[] }) =>
            missingRequiredDocuments(value).length === 0
              ? undefined
              : "Please upload all required documents to continue.",
        }}
      >
        {(field) => {
          const docs = field.state.value;
          const missing = missingRequiredDocuments(docs);
          const uploadedRequired = requiredCount - missing.length;
          const allRequiredMet = missing.length === 0;
          // The promissory note covers the supporting documents — show it
          // whenever one of them hasn't been uploaded.
          const needsPromissory = missingOptionalDocuments(docs).length > 0;

          const setDoc = (doc: UploadedDocument) => {
            const next = [...docs.filter((d) => d.type !== doc.type), doc];
            field.handleChange(next);
            // Clear a now-unnecessary promissory note once every supporting
            // document has been uploaded.
            if (missingOptionalDocuments(next).length === 0) {
              form.setFieldValue("documentPromissoryNote", "");
              form.setFieldValue("documentPromissoryDate", "");
            }
          };
          const removeDoc = (type: ApplicationDocumentType) =>
            field.handleChange(docs.filter((d) => d.type !== type));

          return (
            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-center gap-2 text-xs font-medium",
                  allRequiredMet
                    ? "text-primary dark:text-emerald-500"
                    : "text-muted-foreground",
                )}
              >
                {allRequiredMet && <CheckCircle2 className="size-4" />}
                <span>
                  {allRequiredMet
                    ? "All required documents uploaded"
                    : `${uploadedRequired} of ${requiredCount} required documents uploaded`}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {orderedTypes.map((option) => (
                  <DocumentRow
                    key={option.value}
                    type={option.value}
                    label={option.label}
                    isRequired={option.isRequired}
                    uploaded={docs.find((d) => d.type === option.value)}
                    onUploaded={setDoc}
                    onRemove={() => removeDoc(option.value)}
                  />
                ))}
              </div>

              <FieldInfo field={field} />

              {needsPromissory && <PromissoryNote form={form} />}
            </div>
          );
        }}
      </form.Field>
    </FormSection>
  );
}

// Whether the applicant still owes a supporting (optional) document — drives
// whether the promissory note and its fields are required to advance.
function needsPromissoryNote(form: ApplicationFormApi): boolean {
  return missingOptionalDocuments(form.state.values.documents).length > 0;
}

// Covers the supporting documents the applicant hasn't uploaded: a written
// commitment plus an estimated date to comply. Both are required to advance
// while a supporting document is missing, so an incomplete note can't slip
// through. The panel is only rendered when a supporting document is still owed.
function PromissoryNote({ form }: { form: ApplicationFormApi }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoYearsAhead = new Date(
    today.getFullYear() + 2,
    today.getMonth(),
    today.getDate(),
  );

  return (
    <div className="space-y-3 rounded-lg border p-3.5">
      <div>
        <p className="text-sm font-medium">
          Haven't uploaded all supporting documents?
        </p>
        <p className="text-muted-foreground text-xs">
          Write a promissory note committing to submit the supporting documents
          you didn't upload, and give your estimated date to comply.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field
          name="documentPromissoryNote"
          validators={{
            onChange: ({ value }: { value: string }) =>
              !needsPromissoryNote(form) || value.trim()
                ? undefined
                : "Write a promissory note committing to submit the supporting documents.",
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <FieldLabel
                htmlFor={field.name}
                required
              >
                Promissory note
              </FieldLabel>
              <Textarea
                id={field.name}
                rows={3}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="I promise to submit the remaining required documents by the date below…"
              />
              <FieldInfo field={field} />
            </div>
          )}
        </form.Field>

        <form.Field
          name="documentPromissoryDate"
          validators={{
            onChange: ({ value }: { value: string }) => {
              if (!needsPromissoryNote(form)) return undefined;
              if (!value) return "Select your estimated date to comply.";
              const parsed = new Date(`${value}T00:00:00`);
              if (Number.isNaN(parsed.getTime())) return "Enter a valid date.";
              return parsed < today
                ? "The estimated date to comply must be today or later."
                : undefined;
            },
          }}
        >
          {(field) => (
            <div className="space-y-1.5 max-w-sm">
              <FieldLabel
                htmlFor={field.name}
                required
              >
                Estimated date to comply
              </FieldLabel>
              <DatePicker
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                placeholder="Select estimated date"
                startMonth={today}
                endMonth={twoYearsAhead}
                disabledDates={{ before: today }}
                onChange={(value) => field.handleChange(value)}
              />
              <FieldInfo field={field} />
            </div>
          )}
        </form.Field>
      </div>
    </div>
  );
}
