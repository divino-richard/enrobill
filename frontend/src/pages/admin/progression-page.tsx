import { useState } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  GraduationCapIcon,
  MoveUpIcon,
  RotateCcwIcon,
  Undo2Icon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useDecideProgression,
  useMaterializeProgression,
  useProgression,
  useRevertProgression,
} from "@/features/progression/hooks";
import type {
  CloseoutDecision,
  CloseoutStudent,
  ProgressionDecisionKind,
} from "@/features/progression/types";

const PAGE_SIZE = 8;

const DECISION_META: Record<
  ProgressionDecisionKind,
  { label: string; className: string }
> = {
  promote: {
    label: "Promoted",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  retain: {
    label: "Retained",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  graduate: {
    label: "Graduated",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  },
};

// A bulk decision available on a list (Promote, Retain, Graduate).
interface DecisionAction {
  verb: string;
  kind: ProgressionDecisionKind;
  icon: typeof MoveUpIcon;
  buttonVariant: "default" | "outline";
  describe: (count: number) => string;
}

function ProgressionPage() {
  const { data, isLoading, isError, refetch } = useProgression();
  const decide = useDecideProgression();
  const materialize = useMaterializeProgression();
  const revert = useRevertProgression();

  const pending = data?.pending ?? [];
  const decided = data?.decided ?? [];
  const toPromote = pending.filter((s) => !s.isTopGrade);
  const toGraduate = pending.filter((s) => s.isTopGrade);
  const unmaterialized = decided.filter(
    (d) => d.decision !== "graduate" && !d.materialized,
  );

  const applyDecision = (kind: ProgressionDecisionKind, ids: number[]) =>
    decide.mutate({ studentIds: ids, decision: kind });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progression</h1>
        <p className="text-muted-foreground text-sm">
          Year-end close-out: give every continuing student an outcome —
          promote, retain or graduate. Promoted and retained students are then
          enrolled into the next school year.
        </p>
      </div>

      {decide.isSuccess && <ResultAlert verb="Recorded" count={decide.data} />}
      {decide.isError && (
        <ErrorAlert title="Couldn't save decision" error={decide.error} />
      )}
      {materialize.isSuccess && (
        <ResultAlert verb="Enrolled" count={materialize.data} />
      )}
      {materialize.isError && (
        <ErrorAlert title="Couldn't enroll students" error={materialize.error} />
      )}
      {revert.isSuccess && <ResultAlert verb="Reverted" count={revert.data} />}
      {revert.isError && (
        <ErrorAlert title="Couldn't undo decision" error={revert.error} />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load progression data. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : !data.progressionOpen ? (
        <EmptyState
          title="Progression isn't open"
          message={
            data.activeYear
              ? `Open the progression window for SY ${data.activeYear.schoolYear} on the Academic Years page, or wait until its end date.`
              : "No school year is active. Activate one to run year-end progression."
          }
        />
      ) : (
        <div className="space-y-6">
          {unmaterialized.length > 0 &&
            (data.nextYear ? (
              <Alert className="border-primary/40 bg-primary-foreground text-primary">
                <UsersIcon className="size-4 shrink-0" />
                <AlertTitle>Ready to enroll</AlertTitle>
                <AlertDescription className="text-primary/90 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {unmaterialized.length}{" "}
                    {unmaterialized.length === 1 ? "student" : "students"}{" "}
                    promoted or retained for SY {data.activeYear?.schoolYear} can
                    be enrolled into SY {data.nextYear.schoolYear}.
                  </span>
                  <Button
                    size="sm"
                    className="shrink-0"
                    disabled={materialize.isPending}
                    onClick={() => materialize.mutate()}
                  >
                    <UsersIcon />
                    {materialize.isPending
                      ? "Enrolling…"
                      : `Enroll into SY ${data.nextYear.schoolYear}`}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <CircleAlertIcon className="size-4 shrink-0" />
                <AlertTitle>Next school year needed</AlertTitle>
                <AlertDescription className="text-amber-800/90 dark:text-amber-200/90">
                  {unmaterialized.length}{" "}
                  {unmaterialized.length === 1 ? "student is" : "students are"}{" "}
                  promoted or retained but can't be enrolled yet. Create the next
                  school year on the Academic Years page, then enroll them here.
                </AlertDescription>
              </Alert>
            ))}

          <Tabs defaultValue="promote">
            <TabsList>
              <TabsTrigger value="promote">
                <MoveUpIcon />
                Promotion
                <CountBadge value={toPromote.length} />
              </TabsTrigger>
              <TabsTrigger value="graduate">
                <GraduationCapIcon />
                Graduation
                <CountBadge value={toGraduate.length} />
              </TabsTrigger>
              <TabsTrigger value="decided">
                <Undo2Icon />
                Decided
                <CountBadge value={decided.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="promote" className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Continuing students awaiting a decision for SY{" "}
                {data.activeYear?.schoolYear}. Promote them to the next grade, or
                retain those repeating.
              </p>
              {toPromote.length === 0 ? (
                <EmptyState
                  title="No students to promote"
                  message="Every continuing student below the top grade has been decided."
                  compact
                />
              ) : (
                <DecisionList
                  key={`promote-${toPromote.map((s) => s.studentId).join(",")}`}
                  students={toPromote}
                  variant="promote"
                  pending={decide.isPending}
                  onApply={applyDecision}
                  actions={[
                    {
                      verb: "Promote",
                      kind: "promote",
                      icon: MoveUpIcon,
                      buttonVariant: "default",
                      describe: (n) =>
                        `${n} student${n === 1 ? "" : "s"} will advance to the next grade. They're enrolled into the next school year when you confirm enrollment.`,
                    },
                    {
                      verb: "Retain",
                      kind: "retain",
                      icon: RotateCcwIcon,
                      buttonVariant: "outline",
                      describe: (n) =>
                        `${n} student${n === 1 ? "" : "s"} will repeat their current grade, enrolled into the next school year when you confirm enrollment.`,
                    },
                  ]}
                />
              )}
            </TabsContent>

            <TabsContent value="graduate" className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Top-grade finishers for SY {data.activeYear?.schoolYear}.
                Graduate the passers, or retain those repeating.
              </p>
              {toGraduate.length === 0 ? (
                <EmptyState
                  title="No finishers to graduate"
                  message="Every top-grade finisher has been decided."
                  compact
                />
              ) : (
                <DecisionList
                  key={`graduate-${toGraduate.map((s) => s.studentId).join(",")}`}
                  students={toGraduate}
                  variant="graduate"
                  pending={decide.isPending}
                  onApply={applyDecision}
                  actions={[
                    {
                      verb: "Graduate",
                      kind: "graduate",
                      icon: GraduationCapIcon,
                      buttonVariant: "default",
                      describe: (n) =>
                        `${n} student${n === 1 ? "" : "s"} will be marked as graduated. No next-year enrollment is created.`,
                    },
                    {
                      verb: "Retain",
                      kind: "retain",
                      icon: RotateCcwIcon,
                      buttonVariant: "outline",
                      describe: (n) =>
                        `${n} student${n === 1 ? "" : "s"} will repeat the top grade, enrolled into the next school year when you confirm enrollment.`,
                    },
                  ]}
                />
              )}
            </TabsContent>

            <TabsContent value="decided" className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Decisions recorded for SY {data.activeYear?.schoolYear}. Undo
                reverses a decision; once a promoted or retained student's next
                year bill is paid, it can no longer be undone here.
              </p>
              {decided.length === 0 ? (
                <EmptyState
                  title="No decisions yet"
                  message="Decisions you record appear here, where they can be undone."
                  compact
                />
              ) : (
                <DecidedList
                  rows={decided}
                  isPending={revert.isPending}
                  onUndo={(id) => revert.mutate([id])}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <Badge
      variant="secondary"
      className="ml-0.5 h-5 min-w-5 justify-center px-1 font-normal tabular-nums"
    >
      {value}
    </Badge>
  );
}

function ResultAlert({ verb, count }: { verb: string; count: number }) {
  return (
    <Alert className="border-primary bg-primary-foreground text-primary">
      <CheckCircle2Icon className="size-4 shrink-0" />
      <AlertTitle>{verb}</AlertTitle>
      <AlertDescription>
        {count > 0
          ? `${verb} ${count} ${count === 1 ? "student" : "students"}.`
          : "No students were affected."}
      </AlertDescription>
    </Alert>
  );
}

function ErrorAlert({ title, error }: { title: string; error: unknown }) {
  return (
    <Alert className="border-destructive bg-red-50 text-destructive">
      <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{getErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}

function EmptyState({
  title,
  message,
  compact = false,
}: {
  title: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center",
        compact ? "py-10" : "py-16",
      )}
    >
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <GraduationCapIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {message}
        </p>
      </div>
    </div>
  );
}

// The decided list: every recorded outcome for the ending year, each undoable
// until a materialized next-year enrollment has been billed and paid.
function DecidedList({
  rows,
  isPending,
  onUndo,
}: {
  rows: CloseoutDecision[];
  isPending: boolean;
  onUndo: (id: number) => void;
}) {
  const programLabel = useProgramLabel();

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Enrollment</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const meta = DECISION_META[r.decision];
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {r.studentNumber}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {programLabel(r.track)}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="font-normal">
                      {labelFor(YEAR_LEVEL_OPTIONS, r.fromYearLevel ?? "")}
                    </Badge>
                    <ArrowRightIcon className="text-muted-foreground size-3.5" />
                    <Badge
                      variant="outline"
                      className={cn("font-normal", meta.className)}
                    >
                      {r.decision === "graduate"
                        ? "Graduated"
                        : labelFor(YEAR_LEVEL_OPTIONS, r.toYearLevel ?? "")}
                    </Badge>
                  </span>
                </TableCell>
                <TableCell>
                  {r.decision === "graduate" ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal",
                        r.materialized
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          : "text-muted-foreground",
                      )}
                    >
                      {r.materialized ? "Enrolled" : "Pending enrollment"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.revertable ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending}>
                          <Undo2Icon />
                          Undo
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Undo {r.name}'s decision?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {r.decision === "graduate"
                              ? "Their graduation is reversed and they return to enrolled standing."
                              : "Their grade is restored and any next-year enrollment created for them is removed. Only possible while no payment has been made."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onUndo(r.id)}>
                            Undo
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Billed — locked
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DecisionList({
  students,
  variant,
  pending,
  actions,
  onApply,
}: {
  students: CloseoutStudent[];
  variant: "promote" | "graduate";
  pending: boolean;
  actions: DecisionAction[];
  onApply: (kind: ProgressionDecisionKind, ids: number[]) => void;
}) {
  const programLabel = useProgramLabel();
  // Default to all rows selected (across every page).
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(students.map((s) => s.studentId)),
  );
  const [page, setPage] = useState(0);

  const allSelected = selected.size === students.length;
  const someSelected = selected.size > 0 && !allSelected;

  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const pageRows = students.slice(start, start + PAGE_SIZE);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(students.map((s) => s.studentId)),
    );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? "indeterminate" : false
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>{variant === "promote" ? "Advancement" : "Outcome"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((s) => (
              <TableRow key={s.studentId}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(s.studentId)}
                    onCheckedChange={() => toggle(s.studentId)}
                    aria-label={`Select ${s.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {s.studentNumber}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {programLabel(s.track)}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="font-normal">
                      {labelFor(YEAR_LEVEL_OPTIONS, s.yearLevel ?? "")}
                    </Badge>
                    <ArrowRightIcon className="text-muted-foreground size-3.5" />
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal",
                        variant === "promote"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
                      )}
                    >
                      {variant === "promote"
                        ? labelFor(YEAR_LEVEL_OPTIONS, s.nextYearLevel ?? "")
                        : "Graduated"}
                    </Badge>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {selected.size} of {students.length} selected
        </p>
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeftIcon />
                <span className="sr-only">Previous page</span>
              </Button>
              <span className="text-muted-foreground text-sm tabular-nums">
                Page {safePage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRightIcon />
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          )}
          {actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <AlertDialog key={action.verb}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant={action.buttonVariant}
                    disabled={selected.size === 0 || pending}
                  >
                    <ActionIcon />
                    {`${action.verb} ${selected.size}`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {action.verb} selected students?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {action.describe(selected.size)}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onApply(action.kind, [...selected])}
                    >
                      {action.verb}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ProgressionPage;
