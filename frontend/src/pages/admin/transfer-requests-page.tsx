import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  EyeIcon,
  FunnelXIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProgramGroups, useProgramLabel } from "@/features/programs/hooks";
import { TransferRequestFields } from "@/features/program-transfers/components/transfer-request-fields";
import {
  useAdminTransferRequests,
  useDecideTransferRequest,
} from "@/features/program-transfers/hooks";
import {
  TRANSFER_STATUS_META,
  type TransferRequest,
  type TransferRequestStatus,
} from "@/features/program-transfers/types";

type StatusFilter = TransferRequestStatus | "all";
type ProgramFilter = string | "all";

// Order shown in the status filter.
const STATUS_FILTERS: TransferRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
];

function formatDate(value: string) {
  return format(new Date(value), "PP · p");
}

function TransferStatusBadge({ status }: { status: TransferRequestStatus }) {
  const meta = TRANSFER_STATUS_META[status];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function SortHeader({
  column,
  title,
}: {
  column: Column<TransferRequest, unknown>;
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

function ViewRequestDialog({
  request,
  onOpenChange,
}: {
  request: TransferRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mt-4">
            <div>
              <DialogTitle>{request?.studentName ?? ""}</DialogTitle>
              <DialogDescription>
                {request?.studentNumber ?? ""}
              </DialogDescription>
            </div>
            {request && <TransferStatusBadge status={request.status} />}
          </div>
        </DialogHeader>

        {request && (
          <div className="space-y-4">
            <TransferRequestFields request={request} />

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Reason
              </p>
              <p className="text-sm whitespace-pre-line">{request.reason}</p>
            </div>

            {request.decisionNote && (
              <div
                className={cn(
                  "rounded-lg border p-3",
                  request.status === "approved"
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
                    : "border-destructive/30 bg-destructive/5",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-medium tracking-wide uppercase",
                    request.status === "approved"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-destructive",
                  )}
                >
                  {request.status === "approved"
                    ? "Approval note"
                    : "Rejection note"}
                </p>
                <p className="mt-1 text-sm whitespace-pre-line">
                  {request.decisionNote}
                </p>
              </div>
            )}

            {request.decidedAt && (
              <div className="space-y-0.5 border-t pt-3 text-sm">
                <dt className="text-muted-foreground text-xs">
                  Decided
                  {request.decidedByName ? ` by ${request.decidedByName}` : ""}
                </dt>
                <dd className="font-medium">{formatDate(request.decidedAt)}</dd>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminTransferRequestsPage() {
  const {
    data: requests,
    isLoading,
    isError,
    refetch,
  } = useAdminTransferRequests();
  const decide = useDecideTransferRequest();
  const programGroups = useProgramGroups();
  const programLabel = useProgramLabel();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [programCode, setProgramCode] = useState<ProgramFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "requestedAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status, programCode]);

  const [pendingDecision, setPendingDecision] = useState<{
    request: TransferRequest;
    decision: "approved" | "rejected";
  } | null>(null);
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState<TransferRequest | null>(null);

  const openDecision = useCallback(
    (request: TransferRequest, decision: "approved" | "rejected") => {
      setNote("");
      decide.reset();
      setPendingDecision({ request, decision });
    },
    [decide],
  );

  function confirmDecision() {
    if (!pendingDecision) return;
    decide.mutate(
      {
        id: pendingDecision.request.id,
        status: pendingDecision.decision,
        note: note.trim() || undefined,
      },
      { onSuccess: () => setPendingDecision(null) },
    );
  }

  const isReject = pendingDecision?.decision === "rejected";

  // Memoized: an unstable `data` reference triggers TanStack's pagination
  // auto-reset every render, looping forever.
  const filtered = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return (requests ?? []).filter((request) => {
      if (status !== "all" && request.status !== status) return false;
      if (programCode !== "all" && request.toProgramCode !== programCode) {
        return false;
      }
      if (
        term &&
        !request.studentName.toLowerCase().includes(term) &&
        !request.studentNumber.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [requests, status, programCode, debouncedSearch]);

  const columns = useMemo<ColumnDef<TransferRequest>[]>(
    () => [
      {
        id: "student",
        accessorFn: (row) => row.studentName,
        header: ({ column }) => <SortHeader column={column} title="Student" />,
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {row.original.studentName}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.studentNumber}
            </span>
          </div>
        ),
      },
      {
        id: "transfer",
        header: "Transfer",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="truncate">
              {programLabel(row.original.fromProgramCode)}
            </span>
            <ArrowRightIcon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate font-medium">
              {programLabel(row.original.toProgramCode)}
            </span>
          </div>
        ),
        meta: { className: "min-w-[16rem]" },
      },
      {
        accessorKey: "requestedAt",
        header: ({ column }) => (
          <SortHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.requestedAt)}
          </span>
        ),
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        cell: ({ row }) => <TransferStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <RowActions>
            <DropdownMenuItem onClick={() => setViewing(row.original)}>
              <EyeIcon />
              View details
            </DropdownMenuItem>
            {row.original.status === "pending" && (
              <>
                <DropdownMenuItem
                  onClick={() => openDecision(row.original, "approved")}
                >
                  <CheckIcon />
                  Accept
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => openDecision(row.original, "rejected")}
                >
                  <XIcon />
                  Reject
                </DropdownMenuItem>
              </>
            )}
          </RowActions>
        ),
      },
    ],
    [programLabel, openDecision],
  );

  // TanStack Table returns non-memoizable functions; the React Compiler lint
  // rule flags this by design — safe to ignore.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    enableMultiSort: false,
    enableSortingRemoval: false,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const hasFilters =
    Boolean(debouncedSearch) || status !== "all" || programCode !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setProgramCode("all");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Transfer Requests
        </h1>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load transfer requests. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Transfer Requests
          </h1>
          <p className="text-muted-foreground text-sm">
            Students asking to move to a different track or strand.
          </p>
        </div>

        <Badge variant="outline" className="bg-background">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))_auto]">
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
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_FILTERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {TRANSFER_STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={programCode}
            onValueChange={(value) => setProgramCode(value as ProgramFilter)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All target programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All target programs</SelectItem>
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
          emptyMessage={
            hasFilters
              ? "No transfer requests match your filters."
              : "No transfer requests yet."
          }
        />
      </div>

      <ViewRequestDialog
        request={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />

      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => {
          if (!open && !decide.isPending) setPendingDecision(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isReject
                ? "Reject this transfer request?"
                : "Accept this transfer request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision && (
                <>
                  {pendingDecision.request.studentName} is requesting to move
                  from{" "}
                  <span className="font-medium">
                    {programLabel(pendingDecision.request.fromProgramCode)}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {programLabel(pendingDecision.request.toProgramCode)}
                  </span>
                  .{" "}
                  {!isReject &&
                    "Accepting moves them to the new program right away."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isReject && (
            <div className="space-y-1.5">
              <label
                htmlFor="transfer-decision-note"
                className="text-sm font-medium"
              >
                Note to the student{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Textarea
                id="transfer-decision-note"
                rows={3}
                value={note}
                disabled={decide.isPending}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for rejecting this request…"
              />
            </div>
          )}

          {decide.isError && (
            <p className="text-destructive text-sm">
              {getErrorMessage(decide.error)}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={decide.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={decide.isPending}
              className={
                isReject
                  ? cn(buttonVariants({ variant: "destructive" }))
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                confirmDecision();
              }}
            >
              {decide.isPending ? "Working…" : isReject ? "Reject" : "Accept"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminTransferRequestsPage;
