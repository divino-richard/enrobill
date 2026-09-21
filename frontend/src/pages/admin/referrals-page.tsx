import { RowActions } from "@/components/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { TablePanel, TableToolbar } from "@/components/table-panel";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { EyeIcon, FunnelXIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAdminReferrals } from "@/features/referrals/hooks";
import {
  referralStatusClassName,
  referralStatusLabel,
  type AdminReferral,
} from "@/features/referrals/types";
import { useTerms } from "@/features/terms/hooks";

const STATUS_OPTIONS = ["claimed", "accepted", "successful", "cancelled"];

function ReferralsPage() {
  const navigate = useNavigate();
  const { data: terms } = useTerms();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [schoolYearId, setSchoolYearId] = useState("all");
  const [status, setStatus] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [debouncedSearch, schoolYearId, status]);

  const query = useAdminReferrals({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    search: debouncedSearch || undefined,
    schoolYearId: schoolYearId === "all" ? undefined : Number(schoolYearId),
    status: status === "all" ? undefined : status,
  });

  const columns = useMemo<ColumnDef<AdminReferral>[]>(
    () => [
      {
        id: "referrer",
        accessorFn: (row) => row.referrer?.name ?? "",
        header: "Referrer",
        meta: { className: "min-w-40 max-w-64 whitespace-normal" },
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.referrer?.name ?? "—"}</p>
            <p className="text-muted-foreground text-[0.8125rem]">
              {row.original.referrer?.studentNumber ?? "No student number"}
            </p>
            <p className="text-muted-foreground break-all font-mono text-xs">{row.original.code ?? "Code unavailable"}</p>
            <div className="space-y-1 pt-2 md:hidden">
              <p className="text-muted-foreground text-[0.8125rem]">Referred student</p>
              <p>{row.original.referredStudent?.name ?? row.original.referredApplication?.name ?? "—"}</p>
              <p className="text-muted-foreground text-[0.8125rem]">{row.original.schoolYear ? `SY ${row.original.schoolYear}` : "School year unavailable"}</p>
            </div>
          </div>
        ),
      },
      {
        id: "referred",
        accessorFn: (row) => row.referredApplication?.name ?? "",
        header: "Referred student",
        meta: { className: "hidden min-w-44 max-w-64 whitespace-normal md:table-cell" },
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {row.original.referredStudent?.name ??
                row.original.referredApplication?.name ??
                "—"}
            </p>
            <p className="text-muted-foreground text-[0.8125rem]">
              {row.original.referredStudent?.studentNumber ??
                row.original.referredApplication?.reference ??
                "Application pending"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "schoolYear",
        header: "School year",
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.schoolYear ? `SY ${row.original.schoolYear}` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: { className: "w-32 max-w-48 whitespace-normal md:w-auto" },
        cell: ({ row }) => (
          <div className="space-y-0.5 py-1.5">
            <Badge
              variant="outline"
              className={referralStatusClassName(row.original.status) + " h-auto whitespace-normal"}
            >
              {referralStatusLabel(row.original.status)}
            </Badge>
            {row.original.status === "cancelled" && row.original.cancellationReason && (
              <p
                className="text-muted-foreground max-w-48 break-words text-xs"
              >
                {row.original.cancellationReason}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "w-12 text-right" },
        cell: ({ row }) => {
          const applicationId = row.original.referredApplication?.id;
          return applicationId != null ? (
            <RowActions>
              <DropdownMenuItem onClick={() => navigate(`/admin/applications/${applicationId}`)}><EyeIcon />Application</DropdownMenuItem>
            </RowActions>
          ) : null;
        },
      },
    ],
    [navigate],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: query.data?.rows ?? [],
    columns,
    state: { pagination },
    manualPagination: true,
    rowCount: query.data?.meta.total ?? 0,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasFilters =
    Boolean(debouncedSearch) || schoolYearId !== "all" || status !== "all";

  function clearFilters() {
    setSearch("");
    setSchoolYearId("all");
    setStatus("all");
  }

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <PageHeader title="Referrals" />
      </div>

      <TablePanel>
        <TableToolbar className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))_auto]">
          <div className="space-y-2">

            <div className="relative">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="referral-search" aria-label="Search referrals"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code, student, or application…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">

            <Select value={schoolYearId} onValueChange={setSchoolYearId}>
              <SelectTrigger id="referral-year-filter" aria-label="School year" className="w-full">
                <SelectValue placeholder="All school years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All school years</SelectItem>
                {(terms ?? []).map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    SY {term.schoolYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="referral-status-filter" aria-label="Referral progress" className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {referralStatusLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(hasFilters || search) && <Button
            variant="outline" size="icon" className="size-9"
            onClick={clearFilters}
            aria-label="Clear filters"
            title="Clear filters"
          >
            <FunnelXIcon />
          </Button>}
        </TableToolbar>

        {query.isError ? (
          <div role="alert" className="space-y-3 rounded-lg border px-4 py-10 text-center">
            <p className="text-sm">We couldn't load referrals. Your filters have been kept.</p>
            <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? "Retrying…" : "Try again"}</Button>
          </div>
        ) : (
            <div aria-busy={query.isFetching} className="[&_table]:min-w-0 [&_table]:table-fixed md:[&_table]:table-auto">
            <DataTable
              table={table}
              isLoading={query.isLoading}
              emptyMessage={
                hasFilters
                  ? "No matches. Try another name or code, or clear the filters."
                  : "No referrals yet. Claims appear when a Grade 11 applicant submits a referral code."
              }
            />
          </div>
        )}
      </TablePanel>
    </div>
  );
}

export default ReferralsPage;
