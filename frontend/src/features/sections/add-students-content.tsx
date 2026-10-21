import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon } from "lucide-react";
import type { UnsectionedStudent } from "./types";

export function AddStudentsContent({
  students, availableSeats, loading, error, busy, onRetry, onAdd,
}: {
  students: UnsectionedStudent[];
  availableSeats: number;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onRetry: () => void;
  onAdd: (student: UnsectionedStudent) => void;
}) {
  if (loading) return <p role="status" className="py-4 text-sm text-muted-foreground">Loading available students…</p>;
  if (error) {
    return (
      <div className="space-y-3 py-2">
        <p role="alert" className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (availableSeats <= 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="This section is full"
        description="Increase its capacity in Edit section or move a student to another section before adding someone."
      />
    );
  }
  if (students.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No unassigned students"
        description="There are no enrolled students without a section for this program and grade. To move a student here, open their current section and choose Move."
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {availableSeats} {availableSeats === 1 ? "seat" : "seats"} available
      </p>
      <ul aria-label="Students available to add" className="max-h-[50svh] divide-y overflow-y-auto">
        {students.map(student => (
          <li key={student.enrollmentId} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{student.name}</p>
              <p className="text-xs text-muted-foreground">{student.studentNumber ?? "No student number"}</p>
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busy}
              aria-label={`Add ${student.name} to section`}
              onClick={() => onAdd(student)}
            >Add</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
