import { useId } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ArrowRightLeftIcon } from "lucide-react";
import type { Section } from "./types";

export function MoveStudentForm({
  targets, unavailableTitle, unavailableReason, selectedId, busy, error, onSelect, onMove, onCancel,
}: {
  targets: Section[];
  unavailableTitle: string;
  unavailableReason: string;
  selectedId: number | null;
  busy: boolean;
  error: string | null;
  onSelect: (id: number) => void;
  onMove: (id: number) => void;
  onCancel: () => void;
}) {
  const groupId = useId();
  const selected = targets.find(target => target.id === selectedId);
  return (
    <form
      className="space-y-4"
      aria-busy={busy}
      onSubmit={event => {
        event.preventDefault();
        if (selected && !busy) onMove(selected.id);
      }}
    >
      {targets.length === 0 ? (
        <EmptyState icon={ArrowRightLeftIcon} title={unavailableTitle} description={unavailableReason} />
      ) : (
        <fieldset disabled={busy}>
          <legend className="mb-2 text-sm font-medium">Destination section</legend>
          <p className="mb-3 text-sm text-muted-foreground">
            Same school year, program and grade. Only sections with available seats are listed.
          </p>
          <div className="max-h-[40svh] space-y-2 overflow-y-auto">
            {targets.map(target => {
              const seats = target.capacity - target.assignedCount;
              return (
                <label
                  key={target.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                >
                  <input
                    type="radio"
                    className="size-4 shrink-0 accent-primary"
                    name={groupId}
                    value={target.id}
                    checked={selectedId === target.id}
                    onChange={() => onSelect(target.id)}
                  />
                  <span className="min-w-0 break-words text-sm font-medium">
                    {target.program.toUpperCase()} · {target.name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {seats} {seats === 1 ? "seat" : "seats"} available
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {busy && <p role="status" className="text-sm text-muted-foreground">Moving student…</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          {targets.length === 0 ? "Close" : "Cancel"}
        </Button>
        {targets.length > 0 && <Button type="submit" disabled={!selected || busy}>Move student</Button>}
      </div>
    </form>
  );
}
