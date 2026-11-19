import { useId } from "react";
import { CheckCircle2Icon, CircleAlertIcon, GraduationCapIcon, InfoIcon, MoveUpIcon, RotateCcwIcon, Undo2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { formatPeso } from "@/lib/money";
import { progressionNeedsSettlement } from "./settlement";
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
  const settlementId = useId();
  const retentionId = useId();
  const decided = student.status === "decided";
  const needsSettlement = progressionNeedsSettlement(student);
  const fromGrade = student.fromYearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.fromYearLevel) : null;
  const toGrade = student.toYearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.toYearLevel) : null;
  const nextGrade = student.nextYearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.nextYearLevel) : null;
  const currentGrade = student.yearLevel ? labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel) : null;
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
    <section className="@container/decision space-y-4 border-t pt-5" aria-labelledby={headingId} aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="text-sm font-semibold">Decision</h3>
        {!decided && student.eligible && !needsSettlement && (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2Icon className="size-3" aria-hidden="true" />Ready
          </Badge>
        )}
      </div>

      {decided ? (
        <div className="min-w-0 space-y-1">
          <p className="text-base leading-6 font-semibold">{outcome.title}</p>
          {outcome.detail && <p className="text-sm text-muted-foreground">{outcome.detail}</p>}
        </div>
      ) : (
        <div id={guidanceId} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <p className="font-medium">Academic review</p>
            <p className="text-muted-foreground tabular-nums">{acceptedCount} of 4 accepted</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {acceptedCount === 4
              ? "Both semesters’ clearance and grades have been accepted."
              : `Complete the remaining clearance and grade reviews above before ${primary.kind === "graduate" ? "graduation" : "promotion"}.`}
          </p>
        </div>
      )}

      {needsSettlement && (
        <div id={settlementId} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
            {decided ? "Enrollment on hold" : "Financial hold"}
          </div>
          <dl className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <dt className="text-sm">Prior school-year balance</dt>
            <dd className="min-w-0 break-words text-base font-semibold tabular-nums">{formatPeso(student.settlementBalance)}</dd>
          </dl>
          <div className="space-y-1 text-sm leading-relaxed">
            <p>Ask the cashier to confirm full settlement before {decided ? "creating the next-year enrollment" : "promotion or next-year enrollment"}.</p>
            <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">Only verified payments and applied credits count. Pending payments are excluded.</p>
          </div>
        </div>
      )}

      {(!decided || student.revertable) && (
        <div className="space-y-3 border-t pt-4">
          {!decided && (
            <p id={retentionId} className="text-xs leading-5 text-muted-foreground">
              {currentGrade ? `Retain keeps the student in ${currentGrade}.` : "Retain keeps the student in their current grade."}
            </p>
          )}
          <div className="flex flex-col gap-2 @sm/decision:flex-row @sm/decision:justify-end">
            {decided ? (
              <Button variant="outline" className="h-auto min-h-10 whitespace-normal" disabled={busy || !student.decisionId} onClick={onUndo}>
                <Undo2Icon aria-hidden="true" />{undoPending ? "Undoing…" : "Undo decision"}
              </Button>
            ) : <>
              <Button variant="outline" className="h-auto min-h-10 whitespace-normal" disabled={busy} aria-describedby={retentionId} onClick={() => onDecide("retain")}>
                <RotateCcwIcon aria-hidden="true" />{pendingDecision === "retain" ? "Saving…" : currentGrade ? `Retain in ${currentGrade}` : "Retain"}
              </Button>
              <Button className="h-auto min-h-10 whitespace-normal" disabled={busy || !student.eligible || needsSettlement} aria-describedby={needsSettlement ? `${guidanceId} ${settlementId}` : guidanceId} onClick={() => onDecide(primary.kind)}>
                <primary.Icon aria-hidden="true" />{pendingDecision === primary.kind ? "Saving…" : primary.label}
              </Button>
            </>}
          </div>
        </div>
      )}

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
