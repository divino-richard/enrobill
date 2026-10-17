import { billStatusMeta } from '@/features/bills/collection';
import { CompactProgramLabel } from "@/components/compact-program-label";
import { PageHeader } from "@/components/page-header";
import { TablePanel, TableToolbar } from "@/components/table-panel";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronRightIcon, FunnelXIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { SortHeader } from "@/components/data-table-sort-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { useProgramLabel } from "@/features/programs/hooks";
import { useTerms } from "@/features/terms/hooks";
import { useBills } from "@/features/bills/hooks";
import {
  PAYMENT_STATUS_META,
  type Bill,
  type BillStatus,
  type BillTrackingState,
} from "@/features/bills/types";

type StatusFilter = BillStatus | "all";
type TrackingFilter = BillTrackingState | "all";

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

const TRACKING_FILTERS: { value: TrackingFilter; label: string }[] = [
  { value: "all", label: "All bills" },
  { value: "with_balance", label: "With balance" },
  { value: "due_now", label: "Due now" },
  { value: "pending_payment", label: "To verify" },
];

function BillingPage() {
  const navigate = useNavigate();
  const programLabel = useProgramLabel();
  const { data: terms } = useTerms();
  const schoolYears = terms ?? [];

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [schoolYearId, setSchoolYearId] = useState<string>("all");
  const [trackingState, setTrackingState] = useState<TrackingFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status, schoolYearId, trackingState]);

  const sortState = sorting[0];
  const query = useBills({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id ?? "createdAt",
    dir: !sortState || sortState.desc ? "desc" : "asc",
    status: status === "all" ? undefined : status,
    schoolYearId: schoolYearId === "all" ? undefined : Number(schoolYearId),
    trackingState: trackingState === "all" ? undefined : trackingState,
    search: debouncedSearch || undefined,
  });

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setSchoolYearId("all");
    setTrackingState("all");
  };

  const columns = useMemo<ColumnDef<Bill>[]>(
    () => [
      {
        id: "student",
        // accessorFn is required for TanStack to mark the column sortable, even
        // though ordering is done server-side (manualSorting).
        accessorFn: (row) => row.student?.name ?? "",
        header: ({ column }) => <SortHeader column={column} title="Student" />,
        meta: { className: "min-w-56" },
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 py-1.5">
            <span className="font-medium">
              {row.original.student?.name ?? "—"}
            </span>
            <span className="text-muted-foreground text-[0.8125rem]">
              {row.original.student?.studentNumber ?? "—"}
            </span>
          </div>
        ),
      },
      {
        id: "program",
        header: "Program",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            <CompactProgramLabel label={row.original.student
              ? programLabel(
                  row.original.student.track,
                  row.original.student.yearLevel,
                )
              : "—"} />
          </span>
        ),
      },
      {
        id: "schoolYear",
        header: "School year",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.schoolYear ? `SY ${row.original.schoolYear}` : "—"}
          </span>
        ),
      },
      {
        id: "amountPaid",
        header: "Paid",
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatPeso(row.original.amountPaid)}
          </span>
        ),
      },
      {
        id: "balance",
        header: "Balance",
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {formatPeso(row.original.balance)}
          </span>
        ),
      },
      {
        id: "amountDue",
        header: "Due now",
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {row.original.amountDue > 0
              ? formatPeso(row.original.amountDue)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2 py-1.5">
            <Badge
              variant="outline"
              className={cn(billStatusMeta(row.original).className)}
            >
              {billStatusMeta(row.original).label}
            </Badge>
            {(row.original.pendingPaymentCount ?? 0) > 0 && (
              <Badge
                variant="outline"
                className={PAYMENT_STATUS_META.pending.className}
              >
                {row.original.pendingPaymentCount} pending {row.original.pendingPaymentCount === 1 ? "payment" : "payments"}
              </Badge>
            )}
          </div>
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
              to={`/admin/billing/${row.original.id}`}
              aria-label={`Manage bill for ${row.original.student?.name ?? "student"}`}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          </Button>
        ),
      },
    ],
    [programLabel],
  );

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
    schoolYearId !== "all" ||
    trackingState !== "all";

  return (
    <div className="space-y-4">
      <div>
        <PageHeader title="Billing" />
      </div>

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load bills. Please try again.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <TablePanel>
          <TableToolbar className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
            <div className="relative w-full">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student name or number…"
                className="pl-9"
              />
            </div>

            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger className="w-full" aria-label="Bill status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_PILLS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value === "all" ? "All statuses" : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={schoolYearId} onValueChange={setSchoolYearId}>
              <SelectTrigger className="w-full" aria-label="School year">
                <SelectValue placeholder="All school years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All school years</SelectItem>
                {schoolYears.map((sy) => (
                  <SelectItem key={sy.id} value={String(sy.id)}>
                    SY {sy.schoolYear}
                    {sy.isActive ? " - active" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={trackingState}
              onValueChange={(value) => setTrackingState(value as TrackingFilter)}
            >
              <SelectTrigger className="w-full" aria-label="Payment filter">
                <SelectValue placeholder="All bills" />
              </SelectTrigger>
              <SelectContent>
                {TRACKING_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="outline"
                size="icon"
                onClick={clearFilters}
                aria-label="Clear filters"
                title="Clear filters"
              >
                <FunnelXIcon />
              </Button>
            )}
          </TableToolbar>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            onRowClick={(bill) => navigate(`/admin/billing/${bill.id}`)}
            emptyMessage={
              hasFilters
                ? "No bills match your filters."
                : "No bills yet. Generate bills from the Enrollments page."
            }
          />
        </TablePanel>
      )}
    </div>
  );
}

export default BillingPage;
