import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpRightIcon,
  ReceiptTextIcon,
  SearchIcon,
  SquarePenIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { RowActions } from "@/components/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
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
    feePreview: enrollment.feePreview ?? 0,
  };
}

function getEnrollmentBillingSnapshot(enrollment: Enrollment) {
  const openBills = enrollment.openBills ?? [];
  const openBillCount = enrollment.openBillCount ?? openBills.length;
  const openBillTotal =
    enrollment.openBillTotal ??
    openBills.reduce((sum, bill) => sum + bill.balance, 0);
  const currentOpenBillCount = openBills.filter((bill) => bill.isCurrent).length;
  const priorOpenBillCount = openBillCount - currentOpenBillCount;
  const canGenerateBill =
    enrollment.status === "pending" && enrollment.hasBill === false;
  const hasGeneratedBill = enrollment.hasBill === true;

  return {
    openBills,
    openBillCount,
    openBillTotal,
    currentOpenBillCount,
    priorOpenBillCount,
    canGenerateBill,
    hasGeneratedBill,
  };
}

function BillingInfoDialog({
  enrollment,
  open,
  onOpenChange,
  programLabel,
}: {
  enrollment: Enrollment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programLabel: (
    code: string | null | undefined,
    yearLevel?: string | null,
  ) => string;
}) {
  if (!enrollment) return null;

  const {
    openBills,
    openBillCount,
    openBillTotal,
    currentOpenBillCount,
    priorOpenBillCount,
    canGenerateBill,
    hasGeneratedBill,
  } = getEnrollmentBillingSnapshot(enrollment);

  const studentName = enrollment.student?.name ?? "Student";
  const studentNumber = enrollment.student?.studentNumber ?? "No student number";
  const programName = programLabel(enrollment.program);
  const yearLevel =
    labelFor(YEAR_LEVEL_OPTIONS, enrollment.yearLevel ?? "") || "No year level";
  const schoolYear = enrollment.schoolYear ? `SY ${enrollment.schoolYear}` : "No school year";

  const decisionLabel = openBillCount > 0
    ? "Needs review"
    : canGenerateBill
      ? "Ready for billing"
      : hasGeneratedBill
        ? "Bill already generated"
        : "No billing action";
  const decisionClassName = openBillCount > 0
    ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    : canGenerateBill
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : "border-border";
  const decisionDescription = openBillCount > 0
    ? "Review these unpaid balances before generating a new bill for this enrollment."
    : canGenerateBill
      ? "No unpaid balances are shown here, so the cashier can proceed with bill generation."
      : hasGeneratedBill
        ? "A bill already exists for this enrollment. Review the student record or bill page if needed."
        : "This enrollment does not currently have a billing action available.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Billing info</DialogTitle>
          <DialogDescription>
            {studentName} • {studentNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Enrollment
              </p>
              <p className="mt-1 font-medium">{programName}</p>
              <p className="text-muted-foreground text-sm">{yearLevel}</p>
              <p className="text-muted-foreground mt-2 text-xs">{schoolYear}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Outstanding
              </p>
              <p className="mt-1 font-medium">{formatPeso(openBillTotal)}</p>
              <p className="text-muted-foreground text-sm">
                {openBillCount} unpaid bill{openBillCount === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                New bill estimate
              </p>
              <p className="mt-1 font-medium">
                {enrollment.feePreview != null
                  ? formatPeso(enrollment.feePreview)
                  : "—"}
              </p>
              <p className="text-muted-foreground text-sm">
                {enrollment.hasBill ? "Bill already created" : "For this enrollment"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium">Cashier decision guide</p>
                <p className="text-muted-foreground text-sm">
                  {decisionDescription}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn("shrink-0", decisionClassName)}
              >
                {decisionLabel}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {currentOpenBillCount > 0 && (
                <Badge variant="secondary">
                  {currentOpenBillCount} current balance
                  {currentOpenBillCount === 1 ? "" : "s"}
                </Badge>
              )}
              {priorOpenBillCount > 0 && (
                <Badge variant="secondary">
                  {priorOpenBillCount} prior balance
                  {priorOpenBillCount === 1 ? "" : "s"}
                </Badge>
              )}
              {openBillCount === 0 && (
                <Badge variant="secondary">No unpaid balances found</Badge>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium">Related student bills</p>
              <p className="text-muted-foreground text-sm">
                Review current and prior balances before deciding whether to bill this enrollment.
              </p>
            </div>

            {openBills.length > 0 ? (
              <div className="space-y-3">
                {openBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {bill.schoolYear ? `SY ${bill.schoolYear}` : `Bill #${bill.id}`}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(BILL_STATUS_META[bill.status].className)}
                        >
                          {BILL_STATUS_META[bill.status].label}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {bill.isCurrent ? "Current school year balance" : "Prior school year balance"}
                      </p>
                      <p className="text-sm">
                        Outstanding balance:{" "}
                        <span className="font-medium">{formatPeso(bill.balance)}</span>
                      </p>
                    </div>

                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <Link to={`/admin/billing/${bill.id}`}>
                        Open bill page
                        <ArrowUpRightIcon />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="font-medium">No unpaid or partially paid bills</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  This student has no related balances in the current enrollments list.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EnrollmentActionsCell({
  enrollment,
  isCashier,
  onGenerateBill,
  onViewBilling,
}: {
  enrollment: Enrollment;
  isCashier: boolean;
  onGenerateBill: (target: GenerateBillTarget) => void;
  onViewBilling: (enrollment: Enrollment) => void;
}) {
  const navigate = useNavigate();
  const { canGenerateBill } = getEnrollmentBillingSnapshot(enrollment);
  const studentId = enrollment.student?.id ?? null;

  return (
    <div className="flex justify-end">
      <RowActions>
        <DropdownMenuItem onClick={() => onViewBilling(enrollment)}>
          <ReceiptTextIcon />
          View bill
        </DropdownMenuItem>

        {isCashier && canGenerateBill && (
          <DropdownMenuItem
            onClick={() => onGenerateBill(toGenerateBillTarget(enrollment))}
          >
            <WandSparklesIcon />
            Generate bill
          </DropdownMenuItem>
        )}

        {studentId != null && (
          <DropdownMenuItem onClick={() => navigate(`/admin/students/${studentId}`)}>
            <SquarePenIcon />
            View student
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
  const [billingInfo, setBillingInfo] = useState<Enrollment | null>(null);

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
    pageSize: 15,
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
            <div className="space-y-1">
              <div className="font-medium">{student?.name ?? "—"}</div>
              <div className="text-muted-foreground text-xs">
                {student?.studentNumber ?? "No student number"}
              </div>
            </div>
          );
        },
      },
      {
        id: "enrollment",
        header: "Enrollment",
        enableSorting: false,
        meta: { className: "min-w-64" },
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium">
              {programLabel(row.original.program)}
            </div>
            <div className="text-muted-foreground text-xs">
              {labelFor(YEAR_LEVEL_OPTIONS, row.original.yearLevel ?? "") || "No year level"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader column={column} title="Status" />,
        meta: { className: "min-w-36" },
        cell: ({ row }) => {
          const billingSnapshot = getEnrollmentBillingSnapshot(row.original);

          return (
            <div className="space-y-1">
              <Badge
                variant="outline"
                className={cn(
                  ENROLLMENT_STATUS_META[row.original.status].className,
                )}
              >
                {ENROLLMENT_STATUS_META[row.original.status].label}
              </Badge>

              {billingSnapshot.openBillCount > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {billingSnapshot.openBillCount} unpaid bill
                  {billingSnapshot.openBillCount === 1 ? "" : "s"}
                </p>
              ) : row.original.hasBill ? (
                <p className="text-muted-foreground text-xs">
                  Bill already created
                </p>
              ) : billingSnapshot.canGenerateBill ? (
                <p className="text-muted-foreground text-xs">
                  Ready for billing
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        meta: { className: "w-14 text-right align-top" },
        cell: ({ row }) => (
          <EnrollmentActionsCell
            enrollment={row.original}
            isCashier={isCashier}
            onGenerateBill={setBilling}
            onViewBilling={setBillingInfo}
          />
        ),
      },
    ],
    [isCashier, programLabel],
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enrollments</h1>
        <p className="text-muted-foreground text-sm">
          Every enrollment across school years. Generate a bill for pending
          enrollments — applying the student's voucher, discounts or freebie.
        </p>
        {!isCashier && (
          <p className="text-muted-foreground mt-2 text-sm">
            Bill generation is cashier-only. Admins can review enrollments here
            without generating bills.
          </p>
        )}
      </div>

      {query.isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load enrollments. Please try again.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto]">
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
                {ENROLLMENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
              value={yearLevel}
              onValueChange={(value) => setYearLevel(value as YearLevelFilter)}
            >
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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

      <BillingInfoDialog
        enrollment={billingInfo}
        open={billingInfo != null}
        onOpenChange={(open) => {
          if (!open) setBillingInfo(null);
        }}
        programLabel={programLabel}
      />
    </div>
  );
}

export default EnrollmentsPage;
