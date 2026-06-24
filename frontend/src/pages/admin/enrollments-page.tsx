import { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { SearchIcon, WandSparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { labelFor, YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import { useProgramLabel } from "@/features/programs/hooks";
import { useTerms } from "@/features/terms/hooks";
import { useEnrollments } from "@/features/enrollments/hooks";
import {
  GenerateBillDialog,
  type GenerateBillTarget,
} from "@/features/bills/components/generate-bill-dialog";
import {
  ENROLLMENT_STATUS_META,
  ENROLLMENT_STATUS_OPTIONS,
  type Enrollment,
  type EnrollmentStatus,
} from "@/features/enrollments/types";

type StatusFilter = EnrollmentStatus | "all";

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...ENROLLMENT_STATUS_OPTIONS,
];

function EnrollmentsPage() {
  const programLabel = useProgramLabel();
  const { data: terms } = useTerms();
  const schoolYears = terms ?? [];

  const [billing, setBilling] = useState<GenerateBillTarget | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [schoolYearId, setSchoolYearId] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status, schoolYearId]);

  const sortState = sorting[0];
  const query = useEnrollments({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    status: status === "all" ? undefined : status,
    schoolYearId: schoolYearId === "all" ? undefined : Number(schoolYearId),
    search: debouncedSearch || undefined,
  });

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const columns = useMemo<ColumnDef<Enrollment>[]>(
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
            {programLabel(row.original.program)}
          </span>
        ),
      },
      {
        id: "yearLevel",
        header: "Year level",
        enableSorting: false,
        cell: ({ row }) => labelFor(YEAR_LEVEL_OPTIONS, row.original.yearLevel ?? ""),
      },
      {
        id: "schoolYear",
        header: "School year",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.schoolYear ? `SY ${row.original.schoolYear}` : "—"}
            {row.original.isCurrent && (
              <span className="text-muted-foreground ml-1 text-xs">(active)</span>
            )}
          </span>
        ),
      },
      {
        id: "fees",
        header: "Fees",
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.feePreview != null
              ? formatPeso(row.original.feePreview)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                ENROLLMENT_STATUS_META[row.original.status].className,
              )}
            >
              {ENROLLMENT_STATUS_META[row.original.status].label}
            </Badge>
            {row.original.hasBill && (
              <span className="text-muted-foreground text-xs">billed</span>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "text-right" },
        cell: ({ row }) => {
          const canBill =
            row.original.status === "pending" && row.original.hasBill === false;
          if (!canBill) return null;
          return (
            <Button
              size="sm"
              onClick={() =>
                setBilling({
                  enrollmentId: row.original.id,
                  name: row.original.student?.name ?? "Student",
                  feePreview: row.original.feePreview ?? 0,
                })
              }
            >
              <WandSparklesIcon />
              Generate bill
            </Button>
          );
        },
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
    Boolean(debouncedSearch) || status !== "all" || schoolYearId !== "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enrollments</h1>
        <p className="text-muted-foreground text-sm">
          Every enrollment across school years. Generate a bill for pending
          enrollments — applying the student's voucher, discounts or freebie.
        </p>
      </div>

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load enrollments. Please try again.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student name or number…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Select value={schoolYearId} onValueChange={setSchoolYearId}>
                  <SelectTrigger className="min-44 w-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All academic years</SelectItem>
                    {schoolYears.map((sy) => (
                      <SelectItem key={sy.id} value={String(sy.id)}>
                        SY {sy.schoolYear}
                        {sy.isActive ? " - active" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          </div>

          <DataTable
            table={table}
            isLoading={query.isLoading}
            emptyMessage={
              hasFilters
                ? "No enrollments match your filters."
                : "No enrollments yet."
            }
          />
        </div>
      )}

      {billing && (
        <GenerateBillDialog
          key={billing.enrollmentId}
          enrollment={billing}
          open
          onOpenChange={(open) => {
            if (!open) setBilling(null);
          }}
        />
      )}
    </div>
  );
}

export default EnrollmentsPage;
