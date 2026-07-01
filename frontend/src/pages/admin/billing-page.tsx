import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { ReceiptTextIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { SortHeader } from "@/components/data-table-sort-header";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RowActions } from "@/components/row-actions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { formatDate } from "@/features/applications/utils";
import { useProgramLabel } from "@/features/programs/hooks";
import { useTerms } from "@/features/terms/hooks";
import { useBills } from "@/features/bills/hooks";
import {
  BILL_STATUS_META,
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
  { value: "all", label: "All payment states" },
  { value: "with_balance", label: "Balance remaining" },
  { value: "due_now", label: "Due now / overdue" },
  { value: "pending_payment", label: "Pending payment" },
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
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status, schoolYearId, trackingState]);

  const sortState = sorting[0];
  const query = useBills({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
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
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.student?.name ?? "—"}
            </span>
            <span className="text-muted-foreground text-xs">
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
            {row.original.student
              ? programLabel(
                  row.original.student.track,
                  row.original.student.yearLevel,
                )
              : "—"}
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
        id: "netTotal",
        header: "Net total",
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatPeso(row.original.netTotal)}
            {row.original.discountTotal > 0 && (
              <span className="text-muted-foreground ml-1 text-xs">
                (−{formatPeso(row.original.discountTotal)})
              </span>
            )}
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
          <Badge
            variant="outline"
            className={cn(BILL_STATUS_META[row.original.status].className)}
          >
            {BILL_STATUS_META[row.original.status].label}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortHeader column={column} title="Generated" />,
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
              onClick={() => navigate(`/admin/billing/${row.original.id}`)}
            >
              <ReceiptTextIcon />
              Manage bill
            </DropdownMenuItem>
          </RowActions>
        ),
      },
    ],
    [navigate, programLabel],
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm">
          Every bill across school years. Generate new bills from the
          Enrollments page, then track balances and submitted payments here.
        </p>
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
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
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
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All payment states" />
              </SelectTrigger>
              <SelectContent>
                {TRACKING_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <XIcon />
              Clear
            </Button>
          </div>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters
                ? "No bills match your filters."
                : "No bills yet. Generate bills from the Enrollments page."
            }
          />
        </div>
      )}
    </div>
  );
}

export default BillingPage;
