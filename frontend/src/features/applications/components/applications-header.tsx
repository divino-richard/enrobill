import { PageHeader } from "@/components/page-header";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ApplicationsHeaderProps {
  // Only one in-progress application is allowed at a time.
  hasActiveApplication: boolean;
  onNewApplication?: () => void;
  // Applicants can start new applications; enrolled students view history only.
  canCreate?: boolean;
  // Admissions are currently closed, so new applications are blocked.
  admissionsClosed?: boolean;
}

export function ApplicationsHeader({
  hasActiveApplication,
  onNewApplication,
  canCreate = true,
  admissionsClosed = false,
}: ApplicationsHeaderProps) {
  const disabled = hasActiveApplication || admissionsClosed;
  const disabledReason = admissionsClosed
    ? "Admissions are currently closed."
    : "You already have an application in progress.";

  const newButton = (
    <Button onClick={onNewApplication} disabled={disabled}>
      <PlusIcon />
      Start application
    </Button>
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <PageHeader title={canCreate ? "Applications" : "Admission"} />

      {canCreate &&
        (disabled ? (
          <Tooltip>
            {/* Wrapper span so the tooltip still fires on the disabled button. */}
            <TooltipTrigger asChild>
              <span className="inline-flex w-fit">{newButton}</span>
            </TooltipTrigger>
            <TooltipContent>{disabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          newButton
        ))}
    </div>
  );
}
