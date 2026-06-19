import { useAuthStore } from "@/features/auth/store";
import type { ApplicationFormApi } from "../hooks/form";
import { ApplicationSummary } from "./application-summary";
import { useState } from "react";
import type { UploadedDocument } from "../documents";
import { DocumentViewerDialog } from "./document-viewer-dialog";

interface ReviewStepProps {
  form: ApplicationFormApi;
  enrollmentDate: Date;
}

export function ReviewStep({ form, enrollmentDate }: ReviewStepProps) {
  const { user } = useAuthStore();
  const [viewingDocument, setViewingDocument] =
    useState<UploadedDocument | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Please review your details before submitting. You can go back to any
        step to make changes.
      </p>

      <ApplicationSummary
        values={form.state.values}
        enrollmentDate={enrollmentDate}
        onViewDocument={setViewingDocument}
      />
      {user && (
        <DocumentViewerDialog
          applicationId={user.id}
          document={viewingDocument}
          onOpenChange={(open) => {
            if (!open) setViewingDocument(null);
          }}
        />
      )}
    </div>
  );
}
