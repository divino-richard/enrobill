import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  total: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  compact?: boolean;
  disabled?: boolean;
}

export function TablePagination({
  total,
  pageIndex,
  pageSize,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  onPageSizeChange,
  pageSizeOptions = [15, 30, 50],
  compact = true,
  disabled = false,
}: TablePaginationProps) {
  return (
    <div className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", compact && "gap-3 border-t px-3 py-3 [&_p]:text-[0.8125rem] [&_span]:text-[0.8125rem]")}>
      <p className="text-muted-foreground text-sm">
        {total} {total === 1 ? "result" : "results"}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={disabled}
          >
            <SelectTrigger size={compact ? "default" : "sm"} className="w-[4.5rem]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-muted-foreground text-sm">
          Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
        </span>

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className={cn("size-8", compact && "size-9")}
            onClick={onPreviousPage}
            disabled={disabled || !canPreviousPage}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn("size-8", compact && "size-9")}
            onClick={onNextPage}
            disabled={disabled || !canNextPage}
          >
            <ChevronRightIcon />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
