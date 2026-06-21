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
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  ReceiptTextIcon,
  SearchIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { SortHeader } from "@/components/data-table-sort-header";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { useProgramLabel } from "@/features/programs/hooks";
import { useBills, useGenerateBills } from "@/features/bills/hooks";
import {
  BILL_STATUS_META,
  type Bill,
  type BillStatus,
} from "@/features/bills/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type StatusFilter = BillStatus | "all";

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

function BillingPage() {
  const navigate = useNavigate();
  const generate = useGenerateBills();
  const programLabel = useProgramLabel();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status]);

  const sortState = sorting[0];
  const query = useBills({
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

  const columns = useMemo<ColumnDef<Bill>[]>(
    () => [
      {
        id: "student",
        header: ({ column }) => <SortHeader column={column} title="Student" />,
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
        id: "netTotal",
        header: "Net total",
        enableSorting: false,
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
        id: "balance",
        header: "Balance",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {formatPeso(row.original.balance)}
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

  const hasFilters = Boolean(debouncedSearch) || status !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Bills for the open enrollment term, generated from each program's
            fee structure.
          </p>
        </div>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          <WandSparklesIcon />
          {generate.isPending ? "Generating…" : "Generate bills"}
        </Button>
      </div>

      {generate.isSuccess && (
        <Alert className="border-primary bg-primary-foreground text-primary">
          <CheckCircle2Icon className="size-4 shrink-0" />
          <AlertTitle>Generation successful</AlertTitle>
          <AlertDescription>
            {generate.data.created > 0
              ? `Generated ${generate.data.created} new ${generate.data.created === 1 ? "bill" : "bills"}.`
              : "Everyone eligible is already billed — no new bills."}
          </AlertDescription>
        </Alert>
      )}

      {generate.isError && (
        <Alert className="border-destructive bg-red-50 text-destructive">
          <CircleAlertIcon className="mt-0.5 size-5 shrink-0" />
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>{getErrorMessage(generate.error)}</AlertDescription>
        </Alert>
      )}

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student name or number…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatus(pill.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    status === pill.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters
                ? "No bills match your filters."
                : "No bills for the open term yet. Use Generate bills."
            }
          />
        </div>
      )}
    </div>
  );
}

export default BillingPage;
