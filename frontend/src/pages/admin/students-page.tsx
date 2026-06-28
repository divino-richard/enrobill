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
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  GraduationCapIcon,
  SearchIcon,
  SquarePenIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { useStudents } from "@/features/students/hooks";
import { useProgression } from "@/features/progression/hooks";
import {
  STUDENT_STATUS_OPTIONS,
  studentFullName,
  type Student,
  type StudentStatus,
} from "@/features/students/types";
import { formatDate } from "@/features/applications/utils";

type StatusFilter = StudentStatus | "all";

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

function StudentsPage() {
  const navigate = useNavigate();
  const progression = useProgression();
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

  // The year-end close-out lives on the Progression page; surface a pointer here
  // only while the window is open (a rare, deliberate state).
  const progressionData = progression.data;
  const progressionOpen = progressionData?.progressionOpen ?? false;
  const activeYear = progressionData?.activeYear ?? null;
  const pendingDecisions = progressionData?.pending.length ?? 0;

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
        cell: ({ row }) => (
          <RowActions>
            <DropdownMenuItem
              onClick={() => navigate(`/admin/students/${row.original.id}`)}
            >
              <SquarePenIcon />
              Manage
            </DropdownMenuItem>
          </RowActions>
        ),
      },
    ],
    [navigate],
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
            Manage admitted and enrolled student records.
          </p>
        </div>
      </div>

      {progressionOpen && (
        <Alert className="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200">
          <GraduationCapIcon className="size-4 shrink-0" />
          <AlertTitle>
            Year-end progression is open
            {activeYear ? ` for SY ${activeYear.schoolYear}` : ""}
          </AlertTitle>
          <AlertDescription className="text-violet-800/90 dark:text-violet-200/90 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {pendingDecisions > 0
                ? `${pendingDecisions} ${pendingDecisions === 1 ? "student" : "students"} still need a year-end decision.`
                : "Every student has a decision — review or undo them on the Progression page."}
            </span>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => navigate("/admin/progression")}
            >
              Open Progression
              <ArrowRightIcon />
            </Button>
          </AlertDescription>
        </Alert>
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
