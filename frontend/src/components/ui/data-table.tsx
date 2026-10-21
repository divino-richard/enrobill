import {
  flexRender,
  type RowData,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";

// Per-column styling hook used by the columns' `meta`.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  isLoading?: boolean;
  emptyMessage?: string;
  pageSizeOptions?: number[];
  compact?: boolean;
  onRowClick?: (row: TData) => void;
}

// Presentational data table built on @tanstack/react-table + the shadcn Table
// primitives. Pagination/sorting state lives on the passed-in table instance, so
// it works for both client- and server-driven tables.
export function DataTable<TData>({
  table,
  isLoading = false,
  emptyMessage = "No results.",
  pageSizeOptions = [15, 30, 50],
  compact = true,
  onRowClick,
}: DataTableProps<TData>) {
  const columnCount = table.getAllLeafColumns().length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const total = table.getRowCount();
  const rows = table.getRowModel().rows;

  return (
    <div className={cn("min-w-0 max-w-full space-y-4", compact && "space-y-0")}>
      <div className={cn("min-w-0 max-w-full overflow-x-auto rounded-lg border", compact && "rounded-none border-0")}>
        <Table className={cn("min-w-max", compact && "text-sm [&_th]:h-10 [&_th]:px-3 [&_th]:text-[0.8125rem] [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-0.5")} >
          <TableHeader className={cn(compact && "bg-muted/40")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.className}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: columnCount }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className={cn("h-5 w-full", compact && "h-10")} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(compact && "h-14", onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? (event) => {
                    if (event.defaultPrevented || (event.target as HTMLElement).closest('a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable="true"]')) return;
                    if (window.getSelection()?.toString()) return;
                    onRowClick(row.original);
                  } : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-muted-foreground h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        total={total}
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={pageCount}
        pageSizeOptions={pageSizeOptions}
        compact={compact}
        canPreviousPage={table.getCanPreviousPage()}
        canNextPage={table.getCanNextPage()}
        onPreviousPage={() => table.previousPage()}
        onNextPage={() => table.nextPage()}
        onPageSizeChange={(size) => table.setPageSize(size)}
      />
    </div>
  );
}
