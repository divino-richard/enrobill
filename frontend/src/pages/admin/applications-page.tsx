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
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  EyeIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApplicationStatusBadge } from "@/features/applications/components/application-status-badge";
import { useAllApplications } from "@/features/applications/hooks/use-applications";
import {
  APPLICATION_STATUS_META,
  type AdminApplication,
  type ApplicationStatus,
} from "@/features/applications/types";
import { formatDate } from "@/features/applications/utils";

type StatusFilter = ApplicationStatus | "all";

// Order shown in the filter bar (drafts never reach an admin).
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

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "submittedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status]);

  const sortState = sorting[0];
  const query = useAllApplications({
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
        id: "applicant",
        header: "Applicant",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.applicant.name}</span>
            <span className="text-muted-foreground text-xs">
              {row.original.applicant.email}
            </span>
          </div>
        ),
      },
      {
        id: "program",
        header: "Program",
        enableSorting: false,
        cell: ({ row }) => row.original.program,
      },
      {
        accessorKey: "schoolYear",
        header: ({ column }) => (
          <SortHeader column={column} title="School Year" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {row.original.schoolYear}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <ApplicationStatusBadge status={row.original.status} />
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
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <RowActions>
            <DropdownMenuItem
              onClick={() => navigate(`/admin/applications/${row.original.id}`)}
            >
              <EyeIcon />
              Review
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
    ...STATUS_FILTERS.map((value) => ({
      value,
      label: APPLICATION_STATUS_META[value].label,
    })),
  ];

  const hasFilters = Boolean(debouncedSearch) || status !== "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground text-sm">
          Review enrollment applications submitted by aspiring students.
        </p>
      </div>

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
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference, name, or email…"
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
              hasFilters
                ? "No applications match your filters."
                : "No applications yet."
            }
          />
        </div>
      )}
    </div>
  );
}

export default AdminApplicationsPage;
