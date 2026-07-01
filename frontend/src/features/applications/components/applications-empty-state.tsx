import { FileTextIcon } from "lucide-react";

interface ApplicationsEmptyStateProps {
  // Admissions are closed, so applications can't be started.
  admissionsClosed?: boolean;
}

// Informational only — the "Start application" action lives in the page header
// so there's a single, consistent place to begin one.
export function ApplicationsEmptyState({
  admissionsClosed = false,
}: ApplicationsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <FileTextIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">
          {admissionsClosed ? "Admissions are closed" : "No applications yet"}
        </h3>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {admissionsClosed
            ? "Admissions aren't open right now. Please check back once admissions reopen."
            : "Start an application to apply for admission. You can track its status here once submitted."}
        </p>
      </div>
    </div>
  );
}
