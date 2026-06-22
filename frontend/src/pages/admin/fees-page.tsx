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
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { SortHeader } from "@/components/data-table-sort-header";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { useTerms } from "@/features/terms/hooks";
import { termLabel } from "@/features/terms/types";
import { useProgramLabel } from "@/features/programs/hooks";
import {
  useDeleteFeeStructure,
  useFeeStructures,
  useGenerateFeeStructures,
} from "@/features/fees/hooks";
import { structureTermLabel, type FeeStructure } from "@/features/fees/types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

function FeesPage() {
  const navigate = useNavigate();
  const remove = useDeleteFeeStructure();
  const generate = useGenerateFeeStructures();
  const programLabel = useProgramLabel();

  const { data: terms } = useTerms();
  const openTerm = (terms ?? []).find((term) => term.isActive) ?? null;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [termFilter, setTermFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const [deleting, setDeleting] = useState<FeeStructure | null>(null);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, termFilter]);

  const sortState = sorting[0];
  const query = useFeeStructures({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    termId: termFilter === "all" ? undefined : Number(termFilter),
    search: debouncedSearch || undefined,
  });

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
    } finally {
      setDeleting(null);
    }
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<FeeStructure>[]>(
    () => [
      {
        id: "term",
        header: "Term",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {structureTermLabel(row.original)}
          </span>
        ),
      },
      {
        accessorKey: "program",
        header: ({ column }) => <SortHeader column={column} title="Program" />,
        cell: ({ row }) => (
          <span className="font-medium">
            {programLabel(row.original.track, row.original.yearLevel)}
          </span>
        ),
      },
      {
        id: "items",
        header: "Items",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.items.length}
          </span>
        ),
      },
      {
        id: "total",
        header: "Total",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium whitespace-nowrap">
            {formatPeso(row.original.total)}
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
              onClick={() => navigate(`/admin/fees/${row.original.id}`)}
            >
              <ReceiptTextIcon />
              Manage items
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2Icon />
              Delete
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

  const hasFilters = Boolean(debouncedSearch) || termFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Fee Structures
          </h1>
          <p className="text-muted-foreground text-sm">
            Flat per-semester fees for each program. Bills are built from these.
          </p>
        </div>
        <Button
          onClick={() => generate.mutate()}
          disabled={!openTerm || generate.isPending}
          title={
            openTerm
              ? `Generate for ${termLabel(openTerm)}`
              : "Open a term first"
          }
        >
          <WandSparklesIcon />
          {generate.isPending ? "Generating…" : "Generate structures"}
        </Button>
      </div>

      {generate.isSuccess && (
        <Alert className="border-primary bg-primary-foreground text-primary">
          <CheckCircle2Icon className="size-4 shrink-0" />
          <AlertTitle>Generation successful</AlertTitle>
          <AlertDescription>
            {generate.data.created > 0
              ? `Generated ${generate.data.created} fee ${generate.data.created === 1 ? "structure" : "structures"} for ${openTerm ? termLabel(openTerm) : "the open term"}.`
              : "Every program already has a fee structure for the open term."}
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
            We couldn't load fee structures. Please try again.
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
                placeholder="Search program…"
                className="pl-9"
              />
            </div>
            <Select value={termFilter} onValueChange={setTermFilter}>
              <SelectTrigger size="sm" className="w-full sm:w-[16rem]">
                <SelectValue placeholder="All terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {(terms ?? []).map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {termLabel(term)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters
                ? "No fee structures match your filters."
                : "No fee structures yet. Use Generate structures."
            }
          />
        </div>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fee structure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${programLabel(deleting.track, deleting.yearLevel)} — ${structureTermLabel(deleting)} and its items will be removed. This can't be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default FeesPage;
