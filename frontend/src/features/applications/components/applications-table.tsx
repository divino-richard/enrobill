import { ChevronRightIcon } from "lucide-react";
import { CompactProgramLabel } from "@/components/compact-program-label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApplicationStatusBadge } from "./application-status-badge";
import type { Application } from "../types";
import { formatDate } from "../utils";

interface ApplicationsTableProps {
  applications: Application[];
  onView?: (id: number) => void;
}

export function ApplicationsTable({
  applications,
  onView,
}: ApplicationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Program</TableHead>
          <TableHead>School Year</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => (
          <TableRow
            key={application.id}
            className={onView ? "cursor-pointer" : undefined}
            onClick={onView ? (event) => {
              if (event.defaultPrevented || (event.target as HTMLElement).closest('a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable="true"]')) return;
              if (window.getSelection()?.toString()) return;
              onView(application.id);
            } : undefined}
          >
            <TableCell className="font-medium">
              {application.reference}
            </TableCell>
            <TableCell><CompactProgramLabel label={application.program} /></TableCell>
            <TableCell className="text-muted-foreground">
              {application.schoolYear}
            </TableCell>
            <TableCell>
              <ApplicationStatusBadge status={application.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(application.submittedAt)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`View application ${application.reference}`}
                title="View application"
                onClick={() => onView?.(application.id)}
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
