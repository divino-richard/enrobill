import { DocumentViewerDialog as BaseDocumentViewerDialog } from "@/components/document-viewer-dialog";
import { fetchDocumentBlob, fetchDocumentViewUrl } from "../documents-api";
import type { UploadedDocument } from "../documents";

interface DocumentViewerDialogProps {
  applicationId: number;
  // The document to preview; null closes the dialog.
  document: UploadedDocument | null;
  onOpenChange: (open: boolean) => void;
}

// Previews an applicant's verification document, binding the shared viewer to
// the application-scoped document endpoints.
export function DocumentViewerDialog({
  applicationId,
  document,
  onOpenChange,
}: DocumentViewerDialogProps) {
  return (
    <BaseDocumentViewerDialog
      document={
        document?.id != null
          ? {
              id: document.id,
              fileName: document.fileName,
              contentType: document.contentType,
            }
          : null
      }
      onOpenChange={onOpenChange}
      queryKey={["applications", applicationId, "documents", document?.id, "url"]}
      fetchUrl={(documentId) => fetchDocumentViewUrl(applicationId, documentId)}
      fetchBlob={(documentId) => fetchDocumentBlob(applicationId, documentId)}
    />
  );
}
