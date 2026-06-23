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
          <TableRow key={application.id}>
            <TableCell className="font-medium">
              {application.reference}
            </TableCell>
            <TableCell>{application.program}</TableCell>
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
                size="sm"
                onClick={() => onView?.(application.id)}
              >
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
