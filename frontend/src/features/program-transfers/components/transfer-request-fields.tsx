import { format } from "date-fns";
import { useProgramLabel } from "@/features/programs/hooks";
import type { TransferRequest } from "../types";

function formatDate(value: string) {
  return format(new Date(value), "PP");
}

/**
 * The header fields from the school's physical "Change of Subject Schedule"
 * form, in the same order they appear on it: ID No. / Date / Control No. /
 * Name / Course / Semester-School Year. "Course" is the program being
 * requested — the one the "Change of Subject/Course" is *for*.
 */
export function TransferRequestFields({ request }: { request: TransferRequest }) {
  const programLabel = useProgramLabel();

  const fields: { label: string; value: string }[] = [
    { label: "ID No.", value: request.studentNumber },
    { label: "Date", value: formatDate(request.requestedAt) },
    { label: "Control No.", value: request.controlNumber },
    { label: "Name", value: request.studentName },
    { label: "Course", value: programLabel(request.toProgramCode) },
    { label: "Semester / School Year", value: request.schoolYear },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0 space-y-0.5">
          <dt className="text-muted-foreground text-xs">{field.label}</dt>
          <dd className="font-medium">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
