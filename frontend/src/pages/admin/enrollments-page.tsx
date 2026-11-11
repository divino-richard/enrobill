import { CompactProgramLabel } from "@/components/compact-program-label";
import { PageHeader } from "@/components/page-header";
import { TablePanel, TableToolbar } from "@/components/table-panel";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  FunnelXIcon,
  LoaderCircleIcon,
  ReceiptTextIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react";
import { RowActions } from "@/components/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { SortHeader } from "@/components/data-table-sort-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { labelFor, YEAR_LEVEL_OPTIONS } from "@/features/applications/types";
import { useAuthStore } from "@/features/auth/store";
import { BILL_STATUS_META } from "@/features/bills/types";
import { useProgramGroups, useProgramLabel } from "@/features/programs/hooks";
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
type YearLevelFilter = string | "all";
type TrackFilter = string | "all";

function toGenerateBillTarget(enrollment: Enrollment): GenerateBillTarget {
  return {
    enrollmentId: enrollment.id,
    name: enrollment.student?.name ?? "Student",
    studentNumber: enrollment.student?.studentNumber ?? null,
    schoolYear: enrollment.schoolYear,
    yearLevel: enrollment.yearLevel,
    feePreview: enrollment.feePreview ?? 0,
    voucher: enrollment.voucher ?? null,
  };
}

function getEnrollmentBillingSnapshot(enrollment: Enrollment) {
  const openBills = enrollment.openBills ?? [];
  const otherOpenBills = openBills.filter((bill) => bill.id !== enrollment.bill?.id);
  const canGenerateBill =
    enrollment.status === "pending" && enrollment.hasBill === false && !enrollment.bill;

  return {
    otherOpenBills,
    canGenerateBill,
  };
}

function EnrollmentActionsCell({
  enrollment,
  isCashier,
  onGenerateBill,
  disabled,
}: {
  enrollment: Enrollment;
  isCashier: boolean;
  onGenerateBill: (target: GenerateBillTarget) => void;
  disabled: boolean;
}) {
  const { canGenerateBill } = getEnrollmentBillingSnapshot(enrollment);
  const studentId = enrollment.student?.id ?? null;

  return (
    <div className="flex items-center justify-end gap-1">
      {isCashier && canGenerateBill ? (
        <Button variant="outline" size="sm" disabled={disabled}
          onClick={() => onGenerateBill(toGenerateBillTarget(enrollment))}>
          Generate bill
        </Button>
      ) : null}
      <RowActions label={`Actions for ${enrollment.student?.name ?? "student"}, SY ${enrollment.schoolYear ?? "unknown"}`} disabled={disabled}>
        {enrollment.bill && (
          <DropdownMenuItem asChild>
            <Link to={`/admin/billing/${enrollment.bill.id}`}>
              <ReceiptTextIcon />
              View bill
            </Link>
          </DropdownMenuItem>
        )}

        {studentId != null && (
          <DropdownMenuItem asChild>
            <Link to={`/admin/students/${studentId}`}>
              <UserRoundIcon />
              View student
            </Link>
          </DropdownMenuItem>
        )}
      </RowActions>
    </div>
  );
}

function EnrollmentsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isCashier = role === "cashier";
  const programLabel = useProgramLabel();
  const programGroups = useProgramGroups();
  const { data: terms } = useTerms();
  const schoolYears = terms ?? [];

  const [billing, setBilling] = useState<GenerateBillTarget | null>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [schoolYearId, setSchoolYearId] = useState<string>("all");
  const [yearLevel, setYearLevel] = useState<YearLevelFilter>("all");
  const [trackOrStrand, setTrackOrStrand] = useState<TrackFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 30,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, status, schoolYearId, yearLevel, trackOrStrand]);

  const sortState = sorting[0];
  const query = useEnrollments({
    page: pagination.pageIndex + 1,
    perPage: pagination.pageSize,
    sort: sortState?.id,
    dir: sortState?.desc ? "desc" : "asc",
    status: status === "all" ? undefined : status,
    schoolYearId: schoolYearId === "all" ? undefined : Number(schoolYearId),
    yearLevel: yearLevel === "all" ? undefined : yearLevel,
    programCode: trackOrStrand === "all" ? undefined : trackOrStrand,
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
        // accessorFn is required for TanStack to mark the column sortable, even
        // though ordering is done server-side (manualSorting).
        accessorFn: (row) => row.student?.name ?? "",
        header: ({ column }) => <SortHeader column={column} title="Student" />,
        meta: { className: "min-w-56" },
        cell: ({ row }) => {
          const student = row.original.student;

          return (
            <div className="space-y-0.5 py-1.5">
              <div className="font-medium">{student?.name ?? "—"}</div>
              <div className="text-muted-foreground text-[0.8125rem]">
                {student?.studentNumber ?? "No student number"}
              </div>
            </div>
          );
        },
      },
      {
        id: "enrollment",
        header: "Program & year",
        enableSorting: false,
        meta: { className: "min-w-64" },
        cell: ({ row }) => (
          <div className="space-y-0.5 py-1.5">
            <div className="font-medium">
              <CompactProgramLabel label={programLabel(row.original.program)} />
            </div>
            <div className="text-muted-foreground text-[0.8125rem]">
              {labelFor(YEAR_LEVEL_OPTIONS, row.original.yearLevel ?? "") || "No year level"}
              {row.original.schoolYear ? ` · SY ${row.original.schoolYear}` : " · School year unavailable"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Enrollment status" />,
        meta: { className: "min-w-36" },
        cell: ({ row }) => (
          <Badge variant="outline" className={ENROLLMENT_STATUS_META[row.original.status].className}>
            {ENROLLMENT_STATUS_META[row.original.status].label}
          </Badge>
        ),
      },
      {
        id: "billing",
        header: "Billing",
        enableSorting: false,
        meta: { className: "min-w-40" },
        cell: ({ row }) => {
          const billingSnapshot = getEnrollmentBillingSnapshot(row.original);
          const bill = row.original.bill;

          return (
            <div className="space-y-1 py-1.5">
              {bill ? (
                <Badge variant="outline" className={BILL_STATUS_META[bill.status].className}>
                  {BILL_STATUS_META[bill.status].label}
                </Badge>
              ) : row.original.hasBill ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Billed
                </Badge>
              ) : billingSnapshot.canGenerateBill ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Awaiting bill
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {row.original.hasBill === null ? "Not available" : "No bill"}
                </Badge>
              )}
              {billingSnapshot.otherOpenBills.length > 0 && (
                <div>
                  <Badge variant="outline" className="text-muted-foreground">
                    {billingSnapshot.otherOpenBills.length} other open bill{billingSnapshot.otherOpenBills.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { className: "w-14 text-right align-middle" },
        cell: ({ row }) => (
          <EnrollmentActionsCell
            enrollment={row.original}
            isCashier={isCashier}
            onGenerateBill={setBilling}
            disabled={query.isPlaceholderData}
          />
        ),
      },
    ],
    [isCashier, programLabel, query.isPlaceholderData],
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
    yearLevel !== "all" ||
    trackOrStrand !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setSchoolYearId("all");
    setYearLevel("all");
    setTrackOrStrand("all");
  };

  return (
    <div className="space-y-4">
      <div>
        <PageHeader title="Enrollments" />
      </div>

      <TablePanel>
        <TableToolbar className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto]">
          <div className="relative w-full">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Search enrollments"
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
            <SelectTrigger className="w-full" aria-label="Enrollment status">
              <SelectValue placeholder="All enrollment statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All enrollment statuses</SelectItem>
              {ENROLLMENT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
            value={yearLevel}
            onValueChange={(value) => setYearLevel(value as YearLevelFilter)}
          >
            <SelectTrigger className="w-full" aria-label="Year level">
              <SelectValue placeholder="All year levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All year levels</SelectItem>
              {YEAR_LEVEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={trackOrStrand}
            onValueChange={(value) => setTrackOrStrand(value as TrackFilter)}
          >
            <SelectTrigger className="w-full" aria-label="Track or strand">
              <SelectValue placeholder="All tracks / strands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tracks / strands</SelectItem>
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
        </TableToolbar>

        {query.isError ? (
          <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <p className="text-muted-foreground text-sm">We couldn't load enrollments. Please try again.</p>
            <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? "Retrying…" : "Retry"}
            </Button>
          </div>
        ) : (
          <>
            {query.isFetching && !query.isLoading && (
              <div role="status" className="text-muted-foreground flex items-center gap-2 border-b px-3 py-2 text-xs">
                <LoaderCircleIcon className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
                Updating results…
              </div>
            )}
            <div aria-busy={query.isFetching}>
              <DataTable
                table={table}
                isLoading={query.isLoading}
                emptyMessage={hasFilters ? "No enrollments match your filters." : "No enrollments yet."}
              />
            </div>
          </>
        )}
      </TablePanel>

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
