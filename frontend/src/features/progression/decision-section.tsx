import { useId } from "react";
import { CheckCircle2Icon, GraduationCapIcon, InfoIcon, MoveUpIcon, RotateCcwIcon, Undo2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { SEMESTERS, type ProgressionDecisionKind, type RosterStudent } from "./types";

interface DecisionSectionProps {
  student: RosterStudent;
  busy: boolean;
  pendingDecision: ProgressionDecisionKind | null;
  undoPending: boolean;
  error: string | null;
  onDecide: (decision: ProgressionDecisionKind) => void;
  onUndo: () => void;
}

export function DecisionSection({
  student, busy, pendingDecision, undoPending, error, onDecide, onUndo,
}: DecisionSectionProps) {
  const headingId = useId();
  const guidanceId = useId();
  const decided = student.status === "decided";
  const fromGrade = student.fromYearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.fromYearLevel) : null;
  const toGrade = student.toYearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.toYearLevel) : null;
  const nextGrade = student.nextYearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.nextYearLevel) : null;
  const acceptedCount = SEMESTERS.reduce((total, semester) => {
    const review = student.review[semester];
    return total + Number(review.clearanceCleared) + Number(review.gradesPassed);
  }, 0);
  const primary = student.isTopGrade
    ? { kind: "graduate" as const, label: "Graduate", Icon: GraduationCapIcon }
    : { kind: "promote" as const, label: nextGrade ? `Promote to ${nextGrade}` : "Promote", Icon: MoveUpIcon };

  const outcome = student.decision === "promote"
    ? { title: toGrade ? `Promoted to ${toGrade}` : "Promoted", detail: fromGrade ? `Previously ${fromGrade}` : null }
    : student.decision === "retain"
      ? { title: toGrade || fromGrade ? `Retained in ${toGrade ?? fromGrade}` : "Retained", detail: "Year level unchanged." }
      : student.decision === "graduate"
        ? { title: "Graduated", detail: fromGrade ? `Completed ${fromGrade}` : null }
        : { title: "Decision recorded", detail: null };

  return (
    <section className="@container/decision space-y-3 border-t pt-5" aria-labelledby={headingId} aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="text-sm font-semibold">Decision</h3>
        {!decided && (student.eligible ? (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2Icon className="size-3" aria-hidden="true" />Ready
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">{acceptedCount} of 4 accepted</Badge>
        ))}
      </div>

      <div className="grid items-center gap-4 @lg/decision:grid-cols-[minmax(0,1fr)_auto]">
        {decided ? <>
          <div className="min-w-0 space-y-1">
            <p className="text-base leading-6 font-semibold">{outcome.title}</p>
            {outcome.detail && <p className="text-sm text-muted-foreground">{outcome.detail}</p>}
          </div>
          {student.revertable && (
            <Button variant="outline" className="justify-self-start @lg/decision:justify-self-end" disabled={busy || !student.decisionId} onClick={onUndo}>
              <Undo2Icon aria-hidden="true" />{undoPending ? "Undoing…" : "Undo decision"}
            </Button>
          )}
        </> : <>
          <p id={guidanceId} className="text-sm leading-relaxed text-muted-foreground">
            {student.eligible
              ? "All four requirements accepted."
              : `Accept both semesters’ clearance and grades to ${primary.kind}.`}
          </p>
          <div className="flex flex-wrap items-center gap-2 @lg/decision:justify-end">
            <Button variant="outline" className="flex-1 @lg/decision:flex-none" disabled={busy} onClick={() => onDecide("retain")}>
              <RotateCcwIcon aria-hidden="true" />{pendingDecision === "retain" ? "Saving…" : "Retain"}
            </Button>
            <Button className="flex-1 @lg/decision:flex-none" disabled={busy || !student.eligible} aria-describedby={guidanceId} onClick={() => onDecide(primary.kind)}>
              <primary.Icon aria-hidden="true" />{pendingDecision === primary.kind ? "Saving…" : primary.label}
            </Button>
          </div>
        </>}
      </div>

      {decided && !student.revertable && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          A bill has been created for the next school year. This decision can no longer be undone here.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p role="status" className="sr-only">{pendingDecision ? "Saving decision…" : undoPending ? "Undoing decision…" : ""}</p>
    </section>
  );
}
