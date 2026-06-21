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
  useGraduateStudents,
  usePromoteStudents,
  useProgression,
  useRetainStudents,
  useRevertStudents,
} from "@/features/progression/hooks";

const PAGE_SIZE = 8;

type Variant = "promote" | "graduate" | "revert";

// A normalized row for the selectable lists below.
interface GradeRow {
  id: number;
  studentNumber: string;
  name: string;
  track: string | null;
  fromLevel: string | null;
  toLevel: string | null;
}

// A bulk action available on a list (e.g. Promote, Retain).
interface RowAction {
  verb: string;
  icon: typeof MoveUpIcon;
  buttonVariant: "default" | "outline";
  describe: (count: number, schoolYear: string) => string;
  isPending: boolean;
  onApply: (ids: number[]) => void;
}

// Outcome-column presentation per list type.
const VARIANT_META: Record<
  Variant,
  { header: string; toBadgeClass: string; toLabel: (level: string) => string }
> = {
  promote: {
    header: "Advancement",
    toBadgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    toLabel: (level) => labelFor(YEAR_LEVEL_OPTIONS, level),
  },
  graduate: {
    header: "Outcome",
    toBadgeClass:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
    toLabel: () => "Graduated",
  },
  revert: {
    header: "Reverts to",
    toBadgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    toLabel: (level) => labelFor(YEAR_LEVEL_OPTIONS, level),
  },
};

function ProgressionPage() {
  const { data, isLoading, isError, refetch } = useProgression();
  const promote = usePromoteStudents();
  const retain = useRetainStudents();
  const graduate = useGraduateStudents();
  const revert = useRevertStudents();

  const candidates: GradeRow[] = (data?.candidates ?? []).map((c) => ({
    id: c.id,
    studentNumber: c.studentNumber,
    name: c.name,
    track: c.track,
    fromLevel: c.currentYearLevel,
    toLevel: c.nextYearLevel,
  }));

  const graduates: GradeRow[] = (data?.graduates ?? []).map((c) => ({
    id: c.id,
    studentNumber: c.studentNumber,
    name: c.name,
    track: c.track,
    fromLevel: c.currentYearLevel,
    toLevel: null,
  }));

  const revertible: GradeRow[] = (data?.revertible ?? []).map((c) => ({
    id: c.id,
    studentNumber: c.studentNumber,
    name: c.name,
    track: c.track,
    fromLevel: c.currentYearLevel,
    toLevel: c.previousYearLevel,
  }));

  const promoteAction: RowAction = {
    verb: "Promote",
    icon: MoveUpIcon,
    buttonVariant: "default",
    isPending: promote.isPending,
    onApply: (ids) => promote.mutate(ids),
    describe: (n, sy) =>
      `${n} student${n === 1 ? "" : "s"} will be advanced to the next grade and enrolled for SY ${sy}. Their bill will use the new grade's fee structure.`,
  };
  const retainAction: RowAction = {
    verb: "Retain",
    icon: RotateCcwIcon,
    buttonVariant: "outline",
    isPending: retain.isPending,
    onApply: (ids) => retain.mutate(ids),
    describe: (n, sy) =>
      `${n} student${n === 1 ? "" : "s"} will repeat their current grade and be enrolled for SY ${sy}.`,
  };
  const graduateAction: RowAction = {
    verb: "Graduate",
    icon: GraduationCapIcon,
    buttonVariant: "default",
    isPending: graduate.isPending,
    onApply: (ids) => graduate.mutate(ids),
    describe: (n) =>
      `${n} student${n === 1 ? "" : "s"} will be marked as graduated and will no longer be billed.`,
  };
  const revertAction: RowAction = {
    verb: "Revert",
    icon: Undo2Icon,
    buttonVariant: "outline",
    isPending: revert.isPending,
    onApply: (ids) => revert.mutate(ids),
    describe: (n) =>
      `${n} student${n === 1 ? "" : "s"} will have their new-term enrollment removed and their grade restored. Only possible before billing.`,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progression</h1>
        <p className="text-muted-foreground text-sm">
          Year-end processing: give every continuing student an outcome —
          promote, retain or graduate. Bills can only be generated once every
          student has been decided.
        </p>
      </div>

      {promote.isSuccess && (
        <ResultAlert verb="Promoted" count={promote.data} />
      )}
      {promote.isError && (
        <ErrorAlert title="Promotion failed" error={promote.error} />
      )}
      {retain.isSuccess && <ResultAlert verb="Retained" count={retain.data} />}
      {retain.isError && (
        <ErrorAlert title="Retention failed" error={retain.error} />
      )}
      {graduate.isSuccess && (
        <ResultAlert verb="Graduated" count={graduate.data} />
      )}
      {graduate.isError && (
        <ErrorAlert title="Graduation failed" error={graduate.error} />
      )}
      {revert.isSuccess && <ResultAlert verb="Reverted" count={revert.data} />}
      {revert.isError && (
        <ErrorAlert title="Revert failed" error={revert.error} />
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
      ) : data.openTerm === null ? (
        <EmptyState
          title="No open term"
          message="Open an academic term for the new school year to begin progression."
        />
      ) : (
        <Tabs defaultValue="promote">
          <TabsList>
            <TabsTrigger value="promote">
              <MoveUpIcon />
              Promote
              <CountBadge value={candidates.length} />
            </TabsTrigger>
            <TabsTrigger value="graduate">
              <GraduationCapIcon />
              Graduate
              <CountBadge value={graduates.length} />
            </TabsTrigger>
            <TabsTrigger value="revert">
              <Undo2Icon />
              Revert
              <CountBadge value={revertible.length} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="promote" className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Grade 11 students awaiting a decision for SY{" "}
              {data.openTerm.schoolYear}. Promote them to the next grade, or
              retain those repeating.
            </p>
            {candidates.length === 0 ? (
              <EmptyState
                title="No students to promote"
                message="Every junior has been decided for this school year."
                compact
              />
            ) : (
              <GradeChangeList
                key={`promote-${candidates.map((c) => c.id).join(",")}`}
                rows={candidates}
                schoolYear={data.openTerm.schoolYear}
                variant="promote"
                actions={[promoteAction, retainAction]}
              />
            )}
          </TabsContent>

          <TabsContent value="graduate" className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Grade 12 finishers awaiting a decision for SY{" "}
              {data.openTerm.schoolYear}. Graduate the passers, or retain those
              repeating Grade 12.
            </p>
            {graduates.length === 0 ? (
              <EmptyState
                title="No finishers to graduate"
                message="Every Grade 12 finisher has been decided."
                compact
              />
            ) : (
              <GradeChangeList
                key={`graduate-${graduates.map((c) => c.id).join(",")}`}
                rows={graduates}
                schoolYear={data.openTerm.schoolYear}
                variant="graduate"
                actions={[graduateAction, retainAction]}
              />
            )}
          </TabsContent>

          <TabsContent value="revert" className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Students decided but not yet billed for SY{" "}
              {data.openTerm.schoolYear}. Reverting undoes the decision.
            </p>
            {revertible.length === 0 ? (
              <EmptyState
                title="Nothing to revert"
                message="No decisions can be undone right now."
                compact
              />
            ) : (
              <GradeChangeList
                key={`revert-${revertible.map((c) => c.id).join(",")}`}
                rows={revertible}
                schoolYear={data.openTerm.schoolYear}
                variant="revert"
                actions={[revertAction]}
              />
            )}
          </TabsContent>
        </Tabs>
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
      <AlertTitle>{verb} students</AlertTitle>
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

function GradeChangeList({
  rows,
  schoolYear,
  variant,
  actions,
}: {
  rows: GradeRow[];
  schoolYear: string;
  variant: Variant;
  actions: RowAction[];
}) {
  const programLabel = useProgramLabel();
  // Default to all rows selected (across every page).
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(rows.map((r) => r.id)),
  );
  const [page, setPage] = useState(0);

  const meta = VARIANT_META[variant];
  const anyPending = actions.some((a) => a.isPending);

  const allSelected = selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

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
              <TableHead>{meta.header}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggle(r.id)}
                    aria-label={`Select ${r.name}`}
                  />
                </TableCell>
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
                      {labelFor(YEAR_LEVEL_OPTIONS, r.fromLevel ?? "")}
                    </Badge>
                    <ArrowRightIcon className="text-muted-foreground size-3.5" />
                    <Badge
                      variant="outline"
                      className={cn("font-normal", meta.toBadgeClass)}
                    >
                      {meta.toLabel(r.toLevel ?? "")}
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
          {selected.size} of {rows.length} selected
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
                    disabled={selected.size === 0 || anyPending}
                  >
                    <ActionIcon />
                    {action.isPending
                      ? "Working…"
                      : `${action.verb} ${selected.size}`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {action.verb} selected students?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {action.describe(selected.size, schoolYear)}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => action.onApply([...selected])}>
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
