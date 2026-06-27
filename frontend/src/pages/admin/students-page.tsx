import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  GraduationCapIcon,
  MoveUpIcon,
  RotateCcwIcon,
  SearchIcon,
  SquarePenIcon,
  Undo2Icon,
  UserPlusIcon,
} from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { AdmitStudentDialog } from "@/features/students/components/admit-student-dialog";
import { useStudents } from "@/features/students/hooks";
import { YEAR_LEVEL_OPTIONS, labelFor } from "@/features/applications/types";
import {
  useGraduateStudents,
  useProgression,
  usePromoteStudents,
  useRetainStudents,
  useRevertStudents,
} from "@/features/progression/hooks";
import {
  STUDENT_STATUS_OPTIONS,
  studentFullName,
  type Student,
  type StudentStatus,
} from "@/features/students/types";
import { formatDate } from "@/features/applications/utils";

type StatusFilter = StudentStatus | "all";

type ProgressionActionKind = "promote" | "retain" | "graduate" | "revert";

interface PendingProgressionAction {
  kind: ProgressionActionKind;
  studentId: number;
  title: string;
  description: string;
  confirmLabel: string;
}

function SortHeader({
  column,
  title,
}: {
  column: Column<Student, unknown>;
  title: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded px-1 whitespace-nowrap transition-colors"
    >
      {title}
      {sorted === "asc" ? (
        <ChevronUpIcon className="size-3.5" />
      ) : sorted === "desc" ? (
        <ChevronDownIcon className="size-3.5" />
      ) : (
        <ChevronsUpDownIcon className="size-3.5 opacity-40" />
      )}
    </button>
  );
}

function ResultAlert({ verb, count }: { verb: string; count: number }) {
  return (
    <Alert className="border-primary bg-primary-foreground text-primary">
      <CheckCircle2Icon className="size-4 shrink-0" />
      <AlertTitle>{verb} student</AlertTitle>
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

function StudentsPage() {
  const navigate = useNavigate();
  const progression = useProgression();
  const promote = usePromoteStudents();
  const retain = useRetainStudents();
  const graduate = useGraduateStudents();
  const revert = useRevertStudents();

  const [admitOpen, setAdmitOpen] = useState(false);
  const [progressionAction, setProgressionAction] =
    useState<PendingProgressionAction | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "studentNumber", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  // Any change to the filters returns to the first page.
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status]);

  const sortState = sorting[0];
  const query = useStudents({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    status: status === "all" ? undefined : status,
    search: debouncedSearch || undefined,
  });

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const progressionData = progression.data;
  const openTerm = progressionData?.openTerm ?? null;
  const anyProgressionPending =
    promote.isPending ||
    retain.isPending ||
    graduate.isPending ||
    revert.isPending;

  const candidatesById = useMemo(
    () => new Map((progressionData?.candidates ?? []).map((c) => [c.id, c])),
    [progressionData?.candidates],
  );
  const graduatesById = useMemo(
    () => new Map((progressionData?.graduates ?? []).map((c) => [c.id, c])),
    [progressionData?.graduates],
  );
  const revertibleById = useMemo(
    () => new Map((progressionData?.revertible ?? []).map((c) => [c.id, c])),
    [progressionData?.revertible],
  );

  const applyProgressionAction = () => {
    if (!progressionAction) return;

    const ids = [progressionAction.studentId];

    switch (progressionAction.kind) {
      case "promote":
        promote.mutate(ids);
        break;
      case "retain":
        retain.mutate(ids);
        break;
      case "graduate":
        graduate.mutate(ids);
        break;
      case "revert":
        revert.mutate(ids);
        break;
    }

    setProgressionAction(null);
  };

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        accessorKey: "studentNumber",
        header: ({ column }) => (
          <SortHeader column={column} title="Student No." />
        ),
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {row.original.studentNumber}
          </span>
        ),
        meta: { className: "whitespace-nowrap" },
      },
      {
        id: "name",
        header: ({ column }) => <SortHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{studentFullName(row.original)}</span>
            {row.original.email && (
              <span className="text-muted-foreground text-xs">
                {row.original.email}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "gender",
        header: "Gender",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground capitalize">
            {row.original.gender ?? "—"}
          </span>
        ),
      },
      {
        id: "track",
        header: "Track / Strand",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground uppercase">
            {row.original.trackOrStrand ?? "—"}
          </span>
        ),
      },
      {
        id: "yearLevel",
        header: "Year Level",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {row.original.yearLevel?.replace("_", " ") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "schoolYear",
        header: ({ column }) => (
          <SortHeader column={column} title="School Year" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {row.original.schoolYear ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        cell: ({ row }) => <StudentStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortHeader column={column} title="Admitted" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => {
          const student = row.original;
          const studentName = studentFullName(student);
          const candidate = candidatesById.get(student.id);
          const graduateCandidate = graduatesById.get(student.id);
          const revertible = revertibleById.get(student.id);
          const targetSchoolYear = openTerm?.schoolYear ?? "";
          const hasProgressionActions =
            targetSchoolYear !== "" &&
            (candidate || graduateCandidate || revertible);

          return (
            <RowActions>
              <DropdownMenuItem
                onClick={() => navigate(`/admin/students/${student.id}`)}
              >
                <SquarePenIcon />
                Manage
              </DropdownMenuItem>

              {hasProgressionActions && (
                <>
                  <DropdownMenuSeparator />

                  {candidate && (
                    <DropdownMenuItem
                      disabled={anyProgressionPending}
                      onClick={() =>
                        setProgressionAction({
                          kind: "promote",
                          studentId: student.id,
                          title: `Promote ${studentName}?`,
                          description: `${studentName} will advance from ${labelFor(YEAR_LEVEL_OPTIONS, candidate.currentYearLevel ?? "")} to ${labelFor(YEAR_LEVEL_OPTIONS, candidate.nextYearLevel ?? "")}, be enrolled for SY ${targetSchoolYear}, and be billed immediately at the new grade's fees.`,
                          confirmLabel: "Promote",
                        })
                      }
                    >
                      <MoveUpIcon />
                      Promote
                    </DropdownMenuItem>
                  )}

                  {(candidate || graduateCandidate) && (
                    <DropdownMenuItem
                      disabled={anyProgressionPending}
                      onClick={() => {
                        const currentLevel =
                          candidate?.currentYearLevel ??
                          graduateCandidate?.currentYearLevel ??
                          "";

                        setProgressionAction({
                          kind: "retain",
                          studentId: student.id,
                          title: `Retain ${studentName}?`,
                          description: `${studentName} will repeat ${labelFor(YEAR_LEVEL_OPTIONS, currentLevel)}, be enrolled for SY ${targetSchoolYear}, and be billed immediately.`,
                          confirmLabel: "Retain",
                        });
                      }}
                    >
                      <RotateCcwIcon />
                      Retain
                    </DropdownMenuItem>
                  )}

                  {graduateCandidate && (
                    <DropdownMenuItem
                      disabled={anyProgressionPending}
                      onClick={() =>
                        setProgressionAction({
                          kind: "graduate",
                          studentId: student.id,
                          title: `Graduate ${studentName}?`,
                          description: `${studentName} will be marked as graduated and will no longer be billed for SY ${targetSchoolYear}.`,
                          confirmLabel: "Graduate",
                        })
                      }
                    >
                      <GraduationCapIcon />
                      Graduate
                    </DropdownMenuItem>
                  )}

                  {revertible && (
                    <DropdownMenuItem
                      disabled={anyProgressionPending}
                      onClick={() =>
                        setProgressionAction({
                          kind: "revert",
                          studentId: student.id,
                          title: `Undo ${studentName}'s decision?`,
                          description: `${studentName}'s bill for SY ${targetSchoolYear} will be deleted, their enrollment removed, and their grade restored to ${labelFor(YEAR_LEVEL_OPTIONS, revertible.previousYearLevel ?? "")}. This is only possible while no payment has been made.`,
                          confirmLabel: "Undo",
                        })
                      }
                    >
                      <Undo2Icon />
                      Undo progression
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </RowActions>
          );
        },
      },
    ],
    [
      anyProgressionPending,
      candidatesById,
      graduatesById,
      navigate,
      openTerm,
      revertibleById,
    ],
  );

  // TanStack Table returns non-memoizable functions; the React Compiler lint
  // rule flags this by design — safe to ignore.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: query.data?.rows ?? [],
    columns,
    state: { sorting, pagination },
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    rowCount: query.data?.meta.total ?? 0,
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  });

  const filterPills: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...STUDENT_STATUS_OPTIONS.map((option) => ({
      value: option.value as StatusFilter,
      label: option.label,
    })),
  ];

  const hasFilters = Boolean(debouncedSearch) || status !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-muted-foreground text-sm">
            Manage admitted and enrolled student records, including year-end
            progression.
          </p>
        </div>
        <Button onClick={() => setAdmitOpen(true)}>
          <UserPlusIcon />
          Admit student
        </Button>
      </div>

      <AdmitStudentDialog open={admitOpen} onOpenChange={setAdmitOpen} />
      <AlertDialog
        open={progressionAction !== null}
        onOpenChange={(open) => {
          if (!open) setProgressionAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{progressionAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {progressionAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anyProgressionPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={anyProgressionPending}
              onClick={applyProgressionAction}
            >
              {progressionAction?.confirmLabel ?? "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {promote.isSuccess && (
        <ResultAlert verb="Promoted" count={promote.data ?? 0} />
      )}
      {promote.isError && (
        <ErrorAlert title="Promotion failed" error={promote.error} />
      )}
      {retain.isSuccess && (
        <ResultAlert verb="Retained" count={retain.data ?? 0} />
      )}
      {retain.isError && (
        <ErrorAlert title="Retention failed" error={retain.error} />
      )}
      {graduate.isSuccess && (
        <ResultAlert verb="Graduated" count={graduate.data ?? 0} />
      )}
      {graduate.isError && (
        <ErrorAlert title="Graduation failed" error={graduate.error} />
      )}
      {revert.isSuccess && (
        <ResultAlert verb="Reverted" count={revert.data ?? 0} />
      )}
      {revert.isError && (
        <ErrorAlert title="Undo failed" error={revert.error} />
      )}
      {progression.isError && (
        <ErrorAlert
          title="Progression actions unavailable"
          error={progression.error}
        />
      )}

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load students. Please try again.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, number, or email…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filterPills.map((pill) => {
                const active = status === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setStatus(pill.value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters ? "No students match your filters." : "No students yet."
            }
          />
        </div>
      )}
    </div>
  );
}

export default StudentsPage;
