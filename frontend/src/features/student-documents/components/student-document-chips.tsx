import { useState } from "react";
import { FileTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DocumentViewerDialog } from "@/components/document-viewer-dialog";
import { cn } from "@/lib/utils";
import { fetchStudentDocumentBlob, fetchStudentDocumentViewUrl } from "../api";
import {
  DOCUMENT_TYPES,
  SEMESTERS,
  documentTypeLabel,
  semesterLabel,
  type StudentDocument,
} from "../types";

/**
 * A compact per-semester read-out of a student's clearance and grade slips, so
 * an admin can see at a glance what is missing and open what isn't. Every slot is
 * rendered — a missing one is as meaningful as an uploaded one when judging
 * whether a student passes.
 */
export function StudentDocumentChips({
  documents,
}: {
  documents: StudentDocument[];
}) {
  const [viewing, setViewing] = useState<StudentDocument | null>(null);

  return (
    <div className="space-y-1.5">
      {SEMESTERS.map((semester) => (
        <div key={semester.value} className="flex items-center gap-1.5">
          <span className="text-muted-foreground w-10 shrink-0 text-[11px]">
            {semester.value === "first" ? "1st" : "2nd"}
          </span>
          {DOCUMENT_TYPES.map((type) => {
            const doc = documents.find(
              (d) => d.semester === semester.value && d.type === type.value,
            );

            if (!doc) {
              return (
                <Badge
                  key={type.value}
                  variant="outline"
                  className="text-muted-foreground border-dashed font-normal"
                >
                  {type.label}
                </Badge>
              );
            }

            return (
              <Tooltip key={type.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setViewing(doc)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                      "dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900",
                    )}
                  >
                    <FileTextIcon className="size-3" />
                    {type.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-pretty">
                  {semesterLabel(doc.semester)} {documentTypeLabel(doc.type)} —{" "}
                  {doc.fileName}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}

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
