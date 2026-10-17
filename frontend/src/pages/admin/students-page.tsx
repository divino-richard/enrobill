import { bannerStyles } from "@/components/ui/banner";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  FunnelXIcon,
  SearchIcon,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-primitives";
import { TablePanel } from "@/components/table-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/features/auth/store";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { useStudents } from "@/features/students/hooks";
import { useProgressionSummary } from "@/features/progression/hooks";
import { useProgramGroups } from "@/features/programs/hooks";
import { useTerms } from "@/features/terms/hooks";
import {
  STUDENT_STATUS_OPTIONS,
  studentFullName,
  type Student,
  type StudentStatus,
} from "@/features/students/types";
import { YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import { formatDate } from "@/features/applications/utils";

type StatusFilter = StudentStatus | "all";
type SchoolYearFilter = string | "all";
type YearLevelFilter = string | "all";
type TrackFilter = string | "all";

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
  const isAdmin = useAuthStore((state) => state.user?.role) === "admin";
  const progression = useProgressionSummary();
  const { data: terms } = useTerms();
  const programGroups = useProgramGroups();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [schoolYear, setSchoolYear] = useState<SchoolYearFilter>("all");
  const [yearLevel, setYearLevel] = useState<YearLevelFilter>("all");
  const [trackOrStrand, setTrackOrStrand] = useState<TrackFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "studentNumber", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  // Any change to the filters returns to the first page.
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status, schoolYear, yearLevel, trackOrStrand]);

  const sortState = sorting[0];
  const query = useStudents({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    status: status === "all" ? undefined : status,
    schoolYear: schoolYear === "all" ? undefined : schoolYear,
    yearLevel: yearLevel === "all" ? undefined : yearLevel,
    programCode: trackOrStrand === "all" ? undefined : trackOrStrand,
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
  const pendingDecisions = progressionData?.pending ?? 0;

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
        // accessorFn is required for TanStack to mark the column sortable, even
        // though ordering is done server-side (manualSorting).
        accessorFn: (row) => studentFullName(row),
        header: ({ column }) => <SortHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="max-w-80 space-y-0.5 py-1.5">
            <span className="block truncate font-medium" title={studentFullName(row.original)}>{studentFullName(row.original)}</span>
            {row.original.email && (
              <span className="text-muted-foreground block truncate text-[0.8125rem]" title={row.original.email}>
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
          <span className="font-medium uppercase">
            {row.original.trackOrStrand ?? "—"}
          </span>
        ),
      },
      {
        id: "yearLevel",
        header: "Year Level",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground capitalize whitespace-nowrap">
            {row.original.yearLevel?.replace("_", " ") ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        cell: ({ row }) => <StudentStatusBadge status={row.original.status} className="text-xs" />,
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
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              to={`/admin/students/${row.original.id}`}
              aria-label={`View details for ${studentFullName(row.original)}`}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          </Button>
        ),
      },
    ],
    [],
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

  const hasFilters =
    Boolean(debouncedSearch) ||
    status !== "all" ||
    schoolYear !== "all" ||
    yearLevel !== "all" ||
    trackOrStrand !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setSchoolYear("all");
    setYearLevel("all");
    setTrackOrStrand("all");
  };

  const meta = query.data?.meta;

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Students"
        actions={
          <div className="flex items-center gap-2 text-[0.8125rem] tabular-nums" aria-live="polite">
            <span className="bg-card inline-flex h-9 items-center rounded-md px-3 font-semibold shadow-xs ring-1 ring-foreground/10">
              {meta?.from && meta?.to
                ? `Showing ${meta.from}–${meta.to} of ${meta.total}`
                : `${meta?.total ?? 0} total`}
            </span>
            {query.isFetching && !query.isLoading && (
              <span className="text-muted-foreground">Updating…</span>
            )}
          </div>
        }
      />

      {progressionOpen && isAdmin && (
        <section aria-label="Year-end progression" className={bannerStyles({ className: "flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4" })}>

          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">Year-end progression <span className="text-primary font-normal">{activeYear ? `· SY ${activeYear.schoolYear}` : ""}</span></p>
            <p className="text-primary mt-1 text-sm">{pendingDecisions > 0 ? `${pendingDecisions} ${pendingDecisions === 1 ? "student needs" : "students need"} a year-end decision.` : "All year-end decisions are complete."}</p>
          </div>
          <Button size="sm" onClick={() => navigate("/admin/progression")}>Open progression<ArrowRightIcon /></Button>
        </section>
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
        <TablePanel>
          <div className="grid grid-cols-1 gap-2 border-b p-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1.5fr)_repeat(4,minmax(0,1fr))_auto]">
            <div className="relative w-full sm:col-span-2 xl:col-span-1">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, number, or email…"
                aria-label="Search students"
                className="h-9 pl-9 text-sm md:text-sm"
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger className="w-full text-sm" aria-label="Status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STUDENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={schoolYear}
              onValueChange={(value) => setSchoolYear(value as SchoolYearFilter)}
            >
              <SelectTrigger className="w-full text-sm" aria-label="School year">
                <SelectValue placeholder="All school years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All school years</SelectItem>
                {(terms ?? []).map((term) => (
                  <SelectItem key={term.id} value={term.schoolYear}>
                    {`SY ${term.schoolYear}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={yearLevel}
              onValueChange={(value) => setYearLevel(value as YearLevelFilter)}
            >
              <SelectTrigger className="w-full text-sm" aria-label="Year level">
                <SelectValue placeholder="All year levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All year levels</SelectItem>
                {YEAR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={trackOrStrand}
              onValueChange={(value) => setTrackOrStrand(value as TrackFilter)}
            >
              <SelectTrigger className="w-full text-sm" aria-label="Track or strand">
                <SelectValue placeholder="All tracks / strands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tracks / strands</SelectItem>
                {programGroups.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={clearFilters}
                aria-label="Clear filters"
                title="Clear filters"
              >
                <FunnelXIcon />
              </Button>
            )}
          </div>

          <DataTable
            table={table}
            compact
            isLoading={query.isLoading}
            onRowClick={(student) => navigate(`/admin/students/${student.id}`)}
            emptyMessage={
              hasFilters ? "No students match your filters." : "No students yet."
            }
          />
        </TablePanel>
      )}
    </div>
  );
}

export default StudentsPage;
