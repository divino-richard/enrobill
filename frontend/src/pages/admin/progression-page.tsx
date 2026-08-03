import { useState } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  FileTextIcon,
  GraduationCapIcon,
  MoveUpIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Undo2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import { useProgramGroups, useProgramLabel } from "@/features/programs/hooks";
import { DocumentViewerDialog } from "@/components/document-viewer-dialog";
import {
  fetchStudentDocumentBlob,
  fetchStudentDocumentViewUrl,
} from "@/features/student-documents/api";
import type { StudentDocument } from "@/features/student-documents/types";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useDecideProgression,
  useMaterializeProgression,
  useProgressionRoster,
  useProgressionSummary,
  useReviewSemester,
  useRevertProgression,
} from "@/features/progression/hooks";
import {
  SEMESTERS,
  type ProgressionDecisionKind,
  type ProgressionStatus,
  type RosterFilters,
  type RosterStudent,
  type Semester,
} from "@/features/progression/types";

const PER_PAGE = 10;
const ALL = "all"; // Radix Select can't hold an empty-string value.

const SEMESTER_LABEL: Record<Semester, string> = {
  first: "1st Semester",
  second: "2nd Semester",
};

// The two files a student must clear each semester, and the flag each drives.
const REQUIREMENTS = [
  {
    type: "clearance",
    label: "Clearance",
    field: "clearanceCleared",
    verb: "Cleared",
  },
  { type: "grades", label: "Grades", field: "gradesPassed", verb: "Passed" },
] as const;

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

function ProgressionPage() {
  const summaryQuery = useProgressionSummary();
  const summary = summaryQuery.data;

  const materialize = useMaterializeProgression();
  const decide = useDecideProgression();
  const revert = useRevertProgression();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<ProgressionStatus | "">("");
  const [grade, setGrade] = useState("");
  const [program, setProgram] = useState("");
  const [clearance, setClearance] = useState<"eligible" | "incomplete" | "">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const programGroups = useProgramGroups();

  const filters: RosterFilters = {
    page,
    perPage: PER_PAGE,
    search: debouncedSearch,
    status,
    grade,
    program,
    clearance,
  };
  const rosterQuery = useProgressionRoster(filters);
  const roster = rosterQuery.data?.data ?? [];
  const meta = rosterQuery.data?.meta;

  const selected =
    selectedId != null
      ? (roster.find((s) => s.studentId === selectedId) ?? null)
      : null;

  const hasFilters =
    debouncedSearch !== "" ||
    status !== "" ||
    grade !== "" ||
    program !== "" ||
    clearance !== "";

  // Any filter change returns to the first page so the view can't strand off-range.
  const resetPage = () => setPage(1);
  function clearFilters() {
    setSearch("");
    setStatus("");
    setGrade("");
    setProgram("");
    setClearance("");
    resetPage();
  }

  const progressionOpen = summary?.progressionOpen ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progression</h1>
          <p className="text-muted-foreground text-sm">
            Year-end close-out
            {summary?.activeYear ? ` for SY ${summary.activeYear.schoolYear}` : ""}
            . A student can be promoted or graduated once both semesters are
            cleared and passed.
          </p>
        </div>
        {progressionOpen && summary?.readyToEnroll ? (
          <Button
            disabled={materialize.isPending || !summary.nextYear}
            onClick={() => materialize.mutate()}
            title={
              summary.nextYear
                ? undefined
                : "Create the next school year first"
            }
          >
            <UsersIcon />
            {materialize.isPending
              ? "Enrolling…"
              : summary.nextYear
                ? `Enroll ${summary.readyToEnroll} into SY ${summary.nextYear.schoolYear}`
                : `${summary.readyToEnroll} ready to enroll`}
          </Button>
        ) : null}
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

      {summaryQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      ) : !progressionOpen ? (
        <EmptyState
          title="Progression isn't open"
          message={
            summary?.activeYear
              ? `Open the progression window for SY ${summary.activeYear.schoolYear} on the Academic Years page, or wait until its end date.`
              : "No school year is active. Activate one to run year-end progression."
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Search name or student no."
                className="pl-8"
              />
            </div>

            <FilterSelect
              value={status}
              onChange={(v) => {
                setStatus(v as ProgressionStatus | "");
                resetPage();
              }}
              placeholder="Status"
              options={[
                { value: "pending", label: "Pending" },
                { value: "decided", label: "Decided" },
              ]}
            />
            <FilterSelect
              value={clearance}
              onChange={(v) => {
                setClearance(v as "eligible" | "incomplete" | "");
                resetPage();
              }}
              placeholder="Clearance"
              options={[
                { value: "eligible", label: "Cleared & passed" },
                { value: "incomplete", label: "Incomplete" },
              ]}
            />
            <FilterSelect
              value={grade}
              onChange={(v) => {
                setGrade(v);
                resetPage();
              }}
              placeholder="Grade"
              options={YEAR_LEVEL_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
            <FilterSelect
              value={program}
              onChange={(v) => {
                setProgram(v);
                resetPage();
              }}
              placeholder="Program"
              groups={programGroups}
            />

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
          </div>

          <RosterTable
            rows={roster}
            loading={rosterQuery.isLoading}
            hasFilters={hasFilters}
            onSelect={(id) => setSelectedId(id)}
          />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                {(meta.page - 1) * meta.perPage + 1}–
                {Math.min(meta.page * meta.perPage, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeftIcon />
                  <span className="sr-only">Previous page</span>
                </Button>
                <span className="text-muted-foreground text-sm tabular-nums">
                  Page {meta.page} of {meta.lastPage}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={meta.page >= meta.lastPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRightIcon />
                  <span className="sr-only">Next page</span>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <StudentSheet
        student={selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  groups,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options?: { value: string; label: string }[];
  groups?: { label: string; options: { value: string; label: string }[] }[];
}) {
  return (
    <Select
      value={value || ALL}
      onValueChange={(v) => onChange(v === ALL ? "" : v)}
    >
      <SelectTrigger className="w-auto min-w-32">
        <SlidersHorizontalIcon className="text-muted-foreground size-3.5" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}</SelectItem>
        {options?.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
        {groups?.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function RosterTable({
  rows,
  loading,
  hasFilters,
  onSelect,
}: {
  rows: RosterStudent[];
  loading: boolean;
  hasFilters: boolean;
  onSelect: (id: number) => void;
}) {
  const programLabel = useProgramLabel();

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-md" />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={hasFilters ? "No matching students" : "No students to review"}
        message={
          hasFilters
            ? "No students match these filters. Try clearing them."
            : "Every enrolled student for this year has been decided."
        }
        compact
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Readiness</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.studentId}>
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
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {labelFor(YEAR_LEVEL_OPTIONS, s.yearLevel ?? "")}
              </TableCell>
              <TableCell>
                <ReadinessBadge student={s} />
              </TableCell>
              <TableCell>
                <StatusBadge student={s} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelect(s.studentId)}
                >
                  {s.status === "pending" ? "Review" : "Details"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReadinessBadge({ student }: { student: RosterStudent }) {
  if (student.eligible) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      >
        <CheckCircle2Icon className="size-3" />
        Ready
      </Badge>
    );
  }
  const met = SEMESTERS.reduce((n, s) => {
    const r = student.review[s];
    return n + (r.clearanceCleared ? 1 : 0) + (r.gradesPassed ? 1 : 0);
  }, 0);
  return (
    <span className="text-muted-foreground text-xs tabular-nums">{met}/4</span>
  );
}

function StatusBadge({ student }: { student: RosterStudent }) {
  if (student.status === "pending") {
    return (
      <Badge variant="secondary" className="font-normal">
        Pending
      </Badge>
    );
  }
  const meta = student.decision ? DECISION_META[student.decision] : null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn("font-normal", meta?.className)}
      >
        {meta?.label}
      </Badge>
      {student.decision !== "graduate" && student.materialized && (
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          Enrolled
        </Badge>
      )}
    </span>
  );
}

function StudentSheet({
  student,
  onOpenChange,
}: {
  student: RosterStudent | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={student !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {/* Keyed per student so the open document viewer resets on switch. */}
        {student && <StudentReview key={student.studentId} student={student} />}
      </SheetContent>
    </Sheet>
  );
}

// The per-student detail: each semester's two requirements — file + a checkbox —
// then the decision. Everything that used to crowd a row lives here.
function StudentReview({ student }: { student: RosterStudent }) {
  const programLabel = useProgramLabel();
  const review = useReviewSemester();
  const decide = useDecideProgression();
  const revert = useRevertProgression();
  const [viewing, setViewing] = useState<StudentDocument | null>(null);

  const busy = decide.isPending || revert.isPending;
  const decided = student.status === "decided";
  const reviewBusy = busy || review.isPending;

  const [returning, setReturning] = useState<{
    semester: Semester;
    type: "clearance" | "grades";
    label: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  function accept(semester: Semester, type: "clearance" | "grades") {
    review.mutate({
      studentId: student.studentId,
      semester,
      field: type,
      accepted: true,
    });
  }

  function openReturn(
    semester: Semester,
    type: "clearance" | "grades",
    label: string,
  ) {
    review.reset();
    setReason("");
    setReturning({ semester, type, label });
  }

  function confirmReturn() {
    if (!returning || reason.trim() === "") return;
    review.mutate(
      {
        studentId: student.studentId,
        semester: returning.semester,
        field: returning.type,
        accepted: false,
        note: reason.trim(),
      },
      { onSuccess: () => setReturning(null) },
    );
  }

  const primary = student.isTopGrade
    ? { verb: "Graduate", kind: "graduate" as const, Icon: GraduationCapIcon }
    : { verb: "Promote", kind: "promote" as const, Icon: MoveUpIcon };

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{student.name}</SheetTitle>
        <SheetDescription>
          {student.studentNumber} · {programLabel(student.track)} ·{" "}
          {labelFor(YEAR_LEVEL_OPTIONS, student.yearLevel ?? "")}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 px-4 py-5">
        {SEMESTERS.map((semester) => (
          <section key={semester} className="space-y-2">
            <h3 className="text-sm font-semibold">
              {SEMESTER_LABEL[semester]}
            </h3>
            <div className="divide-y rounded-lg border">
              {REQUIREMENTS.map((req) => {
                const doc =
                  (student.documents ?? []).find(
                    (d) => d.semester === semester && d.type === req.type,
                  ) ?? null;
                const semReview = student.review[semester];
                const accepted = semReview[req.field];
                const note =
                  req.type === "clearance"
                    ? semReview.clearanceNote
                    : semReview.gradesNote;

                return (
                  <div key={req.type} className="space-y-1.5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                        <span className="text-sm">{req.label}</span>
                        {doc ? (
                          <Button
                            variant="link"
                            className="text-primary h-auto px-0 text-xs"
                            onClick={() => setViewing(doc)}
                          >
                            View
                          </Button>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground border-dashed font-normal"
                          >
                            Not uploaded
                          </Badge>
                        )}
                      </div>

                      {accepted ? (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            <CheckCircle2Icon className="size-3" />
                            {req.verb}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reviewBusy || decided}
                            onClick={() =>
                              openReturn(semester, req.type, req.label)
                            }
                          >
                            <XIcon />
                            Return
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={reviewBusy || decided || !doc}
                            onClick={() =>
                              openReturn(semester, req.type, req.label)
                            }
                          >
                            <XIcon />
                            Return
                          </Button>
                          <Button
                            size="sm"
                            disabled={reviewBusy || decided || !doc}
                            onClick={() => accept(semester, req.type)}
                          >
                            <CheckIcon />
                            Accept
                          </Button>
                        </div>
                      )}
                    </div>
                    {note && (
                      <p className="text-amber-800 dark:text-amber-200 text-xs">
                        <span className="font-medium">Returned:</span> {note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {review.isError && (
          <p className="text-destructive text-xs">
            {getErrorMessage(review.error)}
          </p>
        )}

        <section className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Decision</h3>
            {!decided && <ReadinessBadge student={student} />}
          </div>
          {decided ? (
            <DecidedPanel
              student={student}
              pending={revert.isPending}
              onUndo={() =>
                student.decisionId && revert.mutate([student.decisionId])
              }
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  decide.mutate({
                    studentIds: [student.studentId],
                    decision: "retain",
                  })
                }
              >
                <RotateCcwIcon />
                Retain
              </Button>
              <Button
                disabled={busy || !student.eligible}
                title={
                  student.eligible
                    ? undefined
                    : `Clear all four to ${primary.verb.toLowerCase()}`
                }
                onClick={() =>
                  decide.mutate({
                    studentIds: [student.studentId],
                    decision: primary.kind,
                  })
                }
              >
                <primary.Icon />
                {primary.verb}
                {!student.isTopGrade && (
                  <span className="opacity-80">
                    → {labelFor(YEAR_LEVEL_OPTIONS, student.nextYearLevel ?? "")}
                  </span>
                )}
              </Button>
            </div>
          )}
        </section>
      </div>

      <DocumentViewerDialog
        document={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        queryKey={["student-documents", viewing?.id, "url"]}
        fetchUrl={fetchStudentDocumentViewUrl}
        fetchBlob={fetchStudentDocumentBlob}
      />

      <AlertDialog
        open={returning !== null}
        onOpenChange={(open) => {
          if (!open && !review.isPending) setReturning(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Return {returning?.label.toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This unlocks the file so {student.name} can upload a new one.
              Say what needs to change — they'll see this note.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="return-reason" className="text-sm font-medium">
              Reason
            </label>
            <Textarea
              id="return-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What's wrong with the file, or what to fix before resubmitting…"
            />
          </div>

          {review.isError && (
            <p className="text-destructive text-sm">
              {getErrorMessage(review.error)}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={review.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={review.isPending || reason.trim() === ""}
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={(event) => {
                event.preventDefault();
                confirmReturn();
              }}
            >
              {review.isPending ? "Returning…" : "Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DecidedPanel({
  student,
  pending,
  onUndo,
}: {
  student: RosterStudent;
  pending: boolean;
  onUndo: () => void;
}) {
  const meta = student.decision ? DECISION_META[student.decision] : null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-sm">
        <Badge variant="secondary" className="font-normal">
          {labelFor(YEAR_LEVEL_OPTIONS, student.fromYearLevel ?? "")}
        </Badge>
        <ArrowRightIcon className="text-muted-foreground size-3.5" />
        <Badge variant="outline" className={cn("font-normal", meta?.className)}>
          {student.decision === "graduate"
            ? "Graduated"
            : labelFor(YEAR_LEVEL_OPTIONS, student.toYearLevel ?? "")}
        </Badge>
      </div>
      {student.revertable ? (
        <Button variant="outline" disabled={pending} onClick={onUndo}>
          <Undo2Icon />
          Undo decision
        </Button>
      ) : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <CircleAlertIcon className="size-3.5" />
          The next-year bill is paid, so this can no longer be undone here.
        </p>
      )}
    </div>
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

export default ProgressionPage;
