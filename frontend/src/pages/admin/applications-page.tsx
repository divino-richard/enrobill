import { CompactProgramLabel } from "@/components/compact-program-label";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApplicationStatusBadge } from "@/features/applications/components/application-status-badge";
import { useAllApplications } from "@/features/applications/hooks/use-applications";
import { useProgramGroups } from "@/features/programs/hooks";
import { useTerms } from "@/features/terms/hooks";
import {
  APPLICATION_STATUS_META,
  type AdminApplication,
  type ApplicationStatus,
  labelFor,
  YEAR_LEVEL_OPTIONS,
} from "@/features/applications/types";
import { formatDate } from "@/features/applications/utils";

type StatusFilter = ApplicationStatus | "all";
type SchoolYearFilter = string | "all";
type YearLevelFilter = string | "all";
type ProgramFilter = string | "all";

// Order shown in the status filter (drafts never reach an admin).
const STATUS_FILTERS: ApplicationStatus[] = [
  "submitted",
  "under_review",
  "returned",
  "accepted",
  "rejected",
];

function SortHeader({
  column,
  title,
}: {
  column: Column<AdminApplication, unknown>;
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

function AdminApplicationsPage() {
  const navigate = useNavigate();
  const { data: terms } = useTerms();
  const programGroups = useProgramGroups();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [schoolYear, setSchoolYear] = useState<SchoolYearFilter>("all");
  const [yearLevel, setYearLevel] = useState<YearLevelFilter>("all");
  const [programCode, setProgramCode] = useState<ProgramFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "submittedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status, schoolYear, yearLevel, programCode]);

  const sortState = sorting[0];
  const query = useAllApplications({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    status: status === "all" ? undefined : status,
    schoolYear: schoolYear === "all" ? undefined : schoolYear,
    yearLevel: yearLevel === "all" ? undefined : yearLevel,
    programCode: programCode === "all" ? undefined : programCode,
    search: debouncedSearch || undefined,
  });

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setSchoolYear("all");
    setYearLevel("all");
    setProgramCode("all");
  };

  const columns = useMemo<ColumnDef<AdminApplication>[]>(
    () => [
      {
        accessorKey: "reference",
        header: ({ column }) => <SortHeader column={column} title="Reference" />,
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {row.original.reference}
          </span>
        ),
        meta: { className: "whitespace-nowrap" },
      },
      {
        id: "applicantName",
        // accessorFn is required for TanStack to mark the column sortable, even
        // though ordering is done server-side (manualSorting).
        accessorFn: (row) => row.applicant.name,
        header: ({ column }) => <SortHeader column={column} title="Applicant" />,
        cell: ({ row }) => (
          <div className="max-w-80 space-y-0.5 py-1.5">
            <span className="block truncate font-medium" title={row.original.applicant.name}>
              {row.original.applicant.name}
            </span>
            <span className="text-muted-foreground block truncate text-[0.8125rem]" title={row.original.applicant.email}>
              {row.original.applicant.email}
            </span>
          </div>
        ),
        meta: { className: "min-w-[16rem]" },
      },
      {
        id: "program",
        header: "Track / Strand",
        enableSorting: false,
        cell: ({ row }) => (
          <CompactProgramLabel label={row.original.program} />
        ),
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "yearLevel",
        header: ({ column }) => <SortHeader column={column} title="Year" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {labelFor(YEAR_LEVEL_OPTIONS, row.original.yearLevel)}
          </span>
        ),
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <ApplicationStatusBadge status={row.original.status} className="text-xs" />
        ),
      },
      {
        accessorKey: "submittedAt",
        header: ({ column }) => <SortHeader column={column} title="Submitted" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.submittedAt)}
          </span>
        ),
        meta: { className: "whitespace-nowrap" },
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="icon-sm">
            <Link
              to={`/admin/applications/${row.original.id}`}
              aria-label={`View application ${row.original.reference}`}
              title="View application"
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
    programCode !== "all";

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Applications"
        actions={
          query.isFetching && !query.isLoading ? (
            <span role="status" className="text-muted-foreground text-sm">Updating…</span>
          ) : undefined
        }
      />

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load applications. Please try again.
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
                placeholder="Search reference, name, email, school year…"
                aria-label="Search applications"
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
                {STATUS_FILTERS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {APPLICATION_STATUS_META[value].label}
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
              value={programCode}
              onValueChange={(value) => setProgramCode(value as ProgramFilter)}
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
            onRowClick={(application) => navigate(`/admin/applications/${application.id}`)}
            compact
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters
                ? "No applications match your filters."
                : "No applications yet."
            }
          />
        </TablePanel>
      )}
    </div>
  );
}

export default AdminApplicationsPage;
