import { PageHeader } from "@/components/page-header";
import { TablePanel, TableToolbar } from "@/components/table-panel";
import { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { PencilIcon, PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { SortHeader } from "@/components/data-table-sort-header";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { FieldLabel } from "@/components/form/field-label";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  useCreateDiscount,
  useDiscounts,
  useUpdateDiscount,
} from "@/features/discounts/hooks";
import {
  discountValueLabel,
  type Discount,
} from "@/features/discounts/types";

function DiscountDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Discount | null;
}) {
  const create = useCreateDiscount();
  const update = useUpdateDiscount(editing?.id ?? 0);
  const mutation = editing ? update : create;

  // Seeded from props on mount; the parent mounts this fresh per open.
  const [name, setName] = useState(editing?.name ?? "");
  const [value, setValue] = useState(editing ? String(editing.value) : "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  const valid = name.trim() !== "" && value.trim() !== "";

  async function handleSave() {
    const numericValue = Number(value);
    if (!valid || Number.isNaN(numericValue)) return;
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        category: "voucher",
        value: numericValue,
        isActive,
      });
      onOpenChange(false);
    } catch {
      // Surfaced via mutation.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit voucher" : "New voucher"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="name" required>
              Name
            </FieldLabel>
            <Input
              id="name"
              value={name}
              placeholder="e.g. SHS Voucher"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="value" required>
              Amount (₱)
            </FieldLabel>
            <Input
              id="value"
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="voucher-status">Status</FieldLabel>
            <Select
              value={isActive ? "active" : "inactive"}
              onValueChange={(status) => setIsActive(status === "active")}
              disabled={mutation.isPending}
            >
              <SelectTrigger id="voucher-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width)">
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(mutation.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!valid || mutation.isPending}>
            {mutation.isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create voucher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscountsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);

  const sortState = sorting[0];
  const query = useDiscounts({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    search: debouncedSearch || undefined,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(discount: Discount) {
    setEditing(discount);
    setDialogOpen(true);
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<Discount>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "value",
        header: ({ column }) => <SortHeader column={column} title="Value" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {discountValueLabel(row.original)}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "text-muted-foreground"
            }
          >
            {row.original.isActive ? "Active" : "Inactive"}
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
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
          </RowActions>
        ),
      },
    ],
    [],
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

  const hasFilters = Boolean(debouncedSearch);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageHeader title="Vouchers" />
        </div>
        <Button onClick={openNew}>
          <PlusIcon />
          New voucher
        </Button>
      </div>

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load vouchers. Please try again.
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <TablePanel>
          <TableToolbar>
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vouchers…"
              className="pl-9"
            />
          </div>
          </TableToolbar>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters
                ? "No vouchers match your filters."
                : "No vouchers yet."
            }
          />
        </TablePanel>
      )}

      {dialogOpen && (
        <DiscountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
        />
      )}
    </div>
  );
}

export default DiscountsPage;
