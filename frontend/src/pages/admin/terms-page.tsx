import { useState } from "react";
import {
  CalendarDaysIcon,
  CircleAlertIcon,
  GiftIcon,
  GraduationCapIcon,
  LockIcon,
  LockOpenIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/row-actions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FieldLabel } from "@/components/form/field-label";
import { DatePicker } from "@/components/form/date-picker";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatDate } from "@/features/applications/utils";
import {
  useCreateTerm,
  useDeleteTerm,
  useTerms,
  useUpdateTermPolicy,
  useUpdateTermStatus,
} from "@/features/terms/hooks";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useSchoolYearFreebies,
  useUpsertFreebie,
} from "@/features/freebies/hooks";
import type { Freebie } from "@/features/freebies/types";
import {
  termLabel,
  type DownpaymentType,
  type Term,
} from "@/features/terms/types";

interface PolicyState {
  type: DownpaymentType;
  value: string;
  count: string;
}

const EMPTY_POLICY: PolicyState = {
  type: "fixed",
  value: "",
  count: "",
};

function policyToInput(policy: PolicyState) {
  return {
    downpaymentType: policy.type,
    downpaymentValue: Number(policy.value),
    installmentCount: Number(policy.count),
  };
}

const policyComplete = (policy: PolicyState) =>
  policy.value !== "" && policy.count !== "";

function policySummary(term: Term): string {
  const dp =
    term.downpaymentType === "percentage"
      ? `${term.downpaymentValue}%`
      : formatPeso(term.downpaymentValue ?? 0);
  return `${dp} DP · ${term.installmentCount}× monthly`;
}

// Shared installment-policy fields used by the create and edit dialogs.
function PolicyFields({
  policy,
  onChange,
}: {
  policy: PolicyState;
  onChange: (patch: Partial<PolicyState>) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3 sm:col-span-2">
      <p className="text-sm font-medium">Installment policy</p>
      <p className="text-muted-foreground text-xs">
        Every bill is paid by installment: a downpayment plus equal monthly
        payments. Paying more than the downpayment lowers the monthly amount.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>Downpayment type</FieldLabel>
          <Select
            value={policy.type}
            onValueChange={(v) => onChange({ type: v as DownpaymentType })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed (₱)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>
            {policy.type === "percentage" ? "Downpayment %" : "Downpayment ₱"}
          </FieldLabel>
          <Input
            type="number"
            min={0}
            max={policy.type === "percentage" ? 100 : undefined}
            step="0.01"
            value={policy.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <FieldLabel>Monthly installments</FieldLabel>
          <Input
            type="number"
            min={1}
            max={24}
            value={policy.count}
            onChange={(e) => onChange({ count: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function PolicyDialog({
  term,
  onOpenChange,
}: {
  term: Term | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={term !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Installment policy</DialogTitle>
          <DialogDescription>
            {term
              ? `How ${termLabel(term)} is paid. The downpayment and monthly schedule are generated from this.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {term && (
          <PolicyForm
            key={term.id}
            term={term}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PolicyForm({ term, onDone }: { term: Term; onDone: () => void }) {
  const save = useUpdateTermPolicy(term.id);
  const [policy, setPolicy] = useState<PolicyState>({
    type: term.downpaymentType ?? "fixed",
    value: term.downpaymentValue != null ? String(term.downpaymentValue) : "",
    count: term.installmentCount != null ? String(term.installmentCount) : "",
  });

  async function handleSave() {
    if (!policyComplete(policy)) return;
    try {
      await save.mutateAsync(policyToInput(policy));
      onDone();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <>
      <div className="grid gap-4">
        <PolicyFields
          policy={policy}
          onChange={(patch) => setPolicy((prev) => ({ ...prev, ...patch }))}
        />
      </div>
      {save.isError && (
        <p className="text-destructive text-sm">
          {getErrorMessage(save.error)}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!policyComplete(policy) || save.isPending}
        >
          {save.isPending ? "Saving…" : "Save policy"}
        </Button>
      </DialogFooter>
    </>
  );
}

// --- Early-enrollment freebie config -------------------------------------

function FreebieDialog({
  term,
  onOpenChange,
}: {
  term: Term | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={term !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Early-enrollment freebie</DialogTitle>
          <DialogDescription>
            {term
              ? `Grade 11 students who enrol within this window for ${termLabel(term)} can have their balance zeroed when a voucher is applied.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {term && (
          <FreebieForm
            key={term.id}
            term={term}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FreebieForm({ term, onDone }: { term: Term; onDone: () => void }) {
  const { data: freebies, isLoading } = useSchoolYearFreebies(term.id);
  const existing = (freebies ?? []).find((f) => f.type === "early_enrollment");
  const save = useUpsertFreebie(term.id);

  if (isLoading) {
    return <p className="text-muted-foreground py-6 text-sm">Loading…</p>;
  }

  return (
    <FreebieFields
      key={existing?.id ?? "new"}
      term={term}
      existing={existing ?? null}
      save={save}
      onDone={onDone}
    />
  );
}

function FreebieFields({
  term,
  existing,
  save,
  onDone,
}: {
  term: Term;
  existing: Freebie | null;
  save: ReturnType<typeof useUpsertFreebie>;
  onDone: () => void;
}) {
  const [enabled, setEnabled] = useState(existing?.isActive ?? false);
  const [startsOn, setStartsOn] = useState(
    existing?.startsOn ?? term.startDate?.slice(0, 10) ?? "",
  );
  const [endsOn, setEndsOn] = useState(
    existing?.endsOn ?? term.endDate?.slice(0, 10) ?? "",
  );

  async function handleSave() {
    try {
      await save.mutateAsync({
        type: "early_enrollment",
        name: existing?.name ?? "Early Enrollment Promo",
        isActive: enabled,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      });
      onDone();
    } catch {
      // Surfaced via save.isError.
    }
  }

  return (
    <>
      <div className="space-y-4">
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Enable early-enrollment freebie</span>
            <span className="text-muted-foreground block text-xs">
              Offered to Grade 11 students enrolled within the window below.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel>Window start</FieldLabel>
            <DatePicker
              value={startsOn}
              onChange={setStartsOn}
              placeholder="Open-ended"
              startMonth={TERM_DATE_START}
              endMonth={TERM_DATE_END}
              disabledDates={[]}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Window end</FieldLabel>
            <DatePicker
              value={endsOn}
              onChange={setEndsOn}
              placeholder="Open-ended"
              startMonth={TERM_DATE_START}
              endMonth={TERM_DATE_END}
              disabledDates={[]}
            />
          </div>
        </div>
      </div>

      {save.isError && (
        <p className="text-destructive text-sm">{getErrorMessage(save.error)}</p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save freebie"}
        </Button>
      </DialogFooter>
    </>
  );
}

// Two consecutive 4-digit years, e.g. "2026-2027".
const SCHOOL_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

function isValidSchoolYear(value: string): boolean {
  const match = SCHOOL_YEAR_PATTERN.exec(value.trim());
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}

// School-year dates can be current/future, so widen the calendar.
const TERM_DATE_START = new Date(new Date().getFullYear() - 2, 0);
const TERM_DATE_END = new Date(new Date().getFullYear() + 6, 11);

function NewTermDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [schoolYear, setSchoolYear] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [policy, setPolicy] = useState<PolicyState>(EMPTY_POLICY);
  const create = useCreateTerm();

  const schoolYearValid = isValidSchoolYear(schoolYear);
  const datesValid = startDate !== "" && endDate !== "" && endDate >= startDate;
  const canCreate = schoolYearValid && datesValid && policyComplete(policy);

  function reset() {
    setSchoolYear("");
    setStartDate("");
    setEndDate("");
    setPolicy(EMPTY_POLICY);
    create.reset();
  }

  async function handleCreate() {
    if (!canCreate) return;
    try {
      await create.mutateAsync({
        schoolYear: schoolYear.trim(),
        startDate,
        endDate,
        ...policyToInput(policy),
      });
      reset();
      onOpenChange(false);
    } catch {
      // Surfaced below via create.isError.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New school year</DialogTitle>
          <DialogDescription>
            Add a school year and its installment policy. Activate it to start
            enrollment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel
              htmlFor="schoolYear"
              required
              hint="Two consecutive years, e.g. 2026-2027."
            >
              School Year
            </FieldLabel>
            <Input
              id="schoolYear"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="2026-2027"
            />
            {schoolYear.trim() !== "" && !schoolYearValid && (
              <p className="text-destructive text-xs">
                Use the format 2026-2027 (consecutive years).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="startDate" required>
              Start date
            </FieldLabel>
            <DatePicker
              id="startDate"
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
              startMonth={TERM_DATE_START}
              endMonth={TERM_DATE_END}
              disabledDates={[]}
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="endDate" required>
              End date
            </FieldLabel>
            <DatePicker
              id="endDate"
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
              startMonth={TERM_DATE_START}
              endMonth={TERM_DATE_END}
              disabledDates={
                startDate ? { before: new Date(`${startDate}T00:00:00`) } : []
              }
            />
            {startDate !== "" && endDate !== "" && endDate < startDate && (
              <p className="text-destructive text-xs">
                The end date must be on or after the start date.
              </p>
            )}
          </div>

          <PolicyFields
            policy={policy}
            onChange={(patch) => setPolicy((prev) => ({ ...prev, ...patch }))}
          />
        </div>

        {create.isError && (
          <p className="text-destructive text-sm">
            {getErrorMessage(create.error)}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add school year"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type StatusAction = {
  term: Term;
  kind: "active" | "admission" | "progression";
  // For progression, null clears the override so it follows the schedule.
  next: boolean | null;
};

function TermsPage() {
  const { data, isLoading, isError, refetch } = useTerms();
  const terms = data ?? [];
  const activeTerm = terms.find((term) => term.isActive);
  const admissionsOpen = activeTerm?.admissionOpen ?? false;

  const setStatus = useUpdateTermStatus();
  const remove = useDeleteTerm();

  const [newTermOpen, setNewTermOpen] = useState(false);
  const [policyTerm, setPolicyTerm] = useState<Term | null>(null);
  const [freebieTerm, setFreebieTerm] = useState<Term | null>(null);
  const [deleting, setDeleting] = useState<Term | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);

    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (error) {
      setDeleteError(
        getErrorMessage(
          error,
          "We couldn't delete this school year. Please try again.",
        ),
      );
    }
  }

  async function confirmStatus() {
    if (!statusAction) return;
    const { term, kind, next } = statusAction;
    const changes =
      kind === "active"
        ? { isActive: next === true }
        : kind === "admission"
          ? { admissionOpen: next === true }
          : { progressionOpen: next };
    try {
      await setStatus.mutateAsync({ id: term.id, ...changes });
    } catch {
      // no-op
    } finally {
      setStatusAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Academic Years
          </h1>
          <p className="text-muted-foreground text-sm">
            Set the active school year, then open or close its admissions window.
          </p>
        </div>
        <Button onClick={() => setNewTermOpen(true)}>
          <PlusIcon />
          New school year
        </Button>
      </div>

      {!isLoading && !isError && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
            admissionsOpen
              ? "border-primary/50 bg-primary-foreground text-primary"
              : "border-muted-foreground/20 bg-muted text-muted-foreground",
          )}
        >
          <CalendarDaysIcon className="size-4 shrink-0" />
          {activeTerm ? (
            <span>
              <span className="font-medium">{termLabel(activeTerm)}</span> is the
              active school year — admissions are{" "}
              <span className="font-medium">
                {admissionsOpen ? "open" : "closed"}
              </span>
              .
            </span>
          ) : (
            <span>No school year is currently active.</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load school years. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : terms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No school years yet</p>
          <p className="text-muted-foreground text-sm">
            Add a school year to begin setting up enrollment.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Year</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Payment plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">
                    {term.schoolYear}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {term.startDate && term.endDate
                      ? `${formatDate(term.startDate)} – ${formatDate(term.endDate)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {policySummary(term)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          term.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
                        )}
                      >
                        {term.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {term.isActive && (
                        <Badge
                          variant="outline"
                          className={cn(
                            term.admissionOpen
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                              : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
                          )}
                        >
                          {term.admissionOpen
                            ? "Admissions open"
                            : "Admissions closed"}
                        </Badge>
                      )}
                      {term.isActive && term.progressionOpen && (
                        <Badge
                          variant="outline"
                          className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                        >
                          Progression on
                          {term.progressionOverride === null
                            ? " · auto"
                            : " · manual"}
                        </Badge>
                      )}
                      {term.isActive &&
                        !term.progressionOpen &&
                        term.progressionOverride === false &&
                        term.progressionAuto && (
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                          >
                            Progression held
                          </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions>
                      <DropdownMenuItem
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatusAction({
                            term,
                            kind: "active",
                            next: !term.isActive,
                          })
                        }
                      >
                        {term.isActive ? <PowerOffIcon /> : <PowerIcon />}
                        {term.isActive
                          ? "Deactivate school year"
                          : "Set as active"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={setStatus.isPending || !term.isActive}
                        onClick={() =>
                          setStatusAction({
                            term,
                            kind: "admission",
                            next: !term.admissionOpen,
                          })
                        }
                      >
                        {term.admissionOpen ? <LockIcon /> : <LockOpenIcon />}
                        {term.admissionOpen
                          ? "Close admissions"
                          : "Open admissions"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={setStatus.isPending || !term.isActive}
                        onClick={() =>
                          setStatusAction({
                            term,
                            kind: "progression",
                            next: !term.progressionOpen,
                          })
                        }
                      >
                        <GraduationCapIcon />
                        {term.progressionOpen
                          ? "Disable progression"
                          : "Enable progression"}
                      </DropdownMenuItem>
                      {term.isActive && term.progressionOverride !== null && (
                        <DropdownMenuItem
                          disabled={setStatus.isPending}
                          onClick={() =>
                            setStatusAction({
                              term,
                              kind: "progression",
                              next: null,
                            })
                          }
                        >
                          <CalendarDaysIcon />
                          Follow end-date schedule
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setPolicyTerm(term)}>
                        <WalletIcon />
                        Installment policy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFreebieTerm(term)}>
                        <GiftIcon />
                        Early-enrollment freebie
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(term);
                        }}
                      >
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewTermDialog open={newTermOpen} onOpenChange={setNewTermOpen} />

      <FreebieDialog
        term={freebieTerm}
        onOpenChange={(open) => {
          if (!open) setFreebieTerm(null);
        }}
      />

      <PolicyDialog
        term={policyTerm}
        onOpenChange={(open) => {
          if (!open) setPolicyTerm(null);
        }}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this school year?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${termLabel(deleting)} will be removed. This can't be undone.`
                : ""}
              <span className="mt-2 block">
                School years with existing enrollments or bills can't be
                deleted.
              </span>
              {deleting?.isActive && (
                <span className="text-destructive mt-2 flex items-center gap-1.5">
                  <CircleAlertIcon className="size-4" />
                  This is currently the active school year.
                </span>
              )}
              {deleteError && (
                <span className="text-destructive mt-2 flex items-center gap-1.5">
                  <CircleAlertIcon className="size-4" />
                  {deleteError}
                </span>
              )}
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

      <AlertDialog
        open={statusAction !== null}
        onOpenChange={(open) => {
          if (!open && !setStatus.isPending) setStatusAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusAction ? statusActionTitle(statusAction) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusAction ? statusActionBody(statusAction) : ""}
              {statusAction?.kind === "active" &&
                statusAction.next &&
                activeTerm &&
                activeTerm.id !== statusAction.term.id && (
                  <span className="text-destructive mt-2 flex items-center gap-1.5">
                    <CircleAlertIcon className="size-4" />
                    {termLabel(activeTerm)} is currently active and will be
                    deactivated.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setStatus.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={setStatus.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmStatus();
              }}
            >
              {setStatus.isPending
                ? "Saving…"
                : statusAction
                  ? statusActionConfirm(statusAction)
                  : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function statusActionTitle(action: StatusAction): string {
  if (action.kind === "active") {
    return action.next
      ? "Set this school year as active?"
      : "Deactivate this school year?";
  }
  if (action.kind === "progression") {
    if (action.next === null) {
      return "Follow the end-date schedule for progression?";
    }
    return action.next
      ? "Enable progression for this school year?"
      : "Disable progression for this school year?";
  }
  return action.next
    ? "Open admissions for this school year?"
    : "Close admissions for this school year?";
}

function statusActionBody(action: StatusAction): string {
  const label = termLabel(action.term);
  if (action.kind === "active") {
    return action.next
      ? `${label} will become the active school year. Bills, the student portal and dashboards will operate on it.`
      : `${label} will be deactivated. Bills, the portal and dashboards will have no active school year, and its admissions and progression will close, until you activate another.`;
  }
  if (action.kind === "progression") {
    if (action.next === null) {
      return `Progression for ${label} will follow its end date — opening automatically once the year has ended, with no manual override.`;
    }
    return action.next
      ? `Year-end promotion, retention and graduation actions for ${label} become available on the Students page now, regardless of its end date.`
      : `Year-end progression actions for ${label} will be hidden on the Students page, even if its end date has passed. Decisions already made are unaffected.`;
  }
  return action.next
    ? `Applicants will be able to submit applications for ${label}.`
    : `New applications for ${label} will be blocked. Existing bills and the student portal are unaffected.`;
}

function statusActionConfirm(action: StatusAction): string {
  if (action.kind === "active") {
    return action.next ? "Set as active" : "Deactivate";
  }
  if (action.kind === "progression") {
    if (action.next === null) {
      return "Follow schedule";
    }
    return action.next ? "Enable progression" : "Disable progression";
  }
  return action.next ? "Open admissions" : "Close admissions";
}

export default TermsPage;
