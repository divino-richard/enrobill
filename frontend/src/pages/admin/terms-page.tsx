import { useState } from "react";
import {
  CalendarDaysIcon,
  CircleAlertIcon,
  PlusIcon,
  Trash2Icon,
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
import { getErrorMessage } from "@/lib/get-error-message";
import { formatDate } from "@/features/applications/utils";
import {
  useCreateTerm,
  useDeleteTerm,
  useSetTermOpen,
  useTerms,
} from "@/features/terms/hooks";
import {
  TERM_SEMESTER_OPTIONS,
  semesterLabel,
  termLabel,
  type Term,
  type TermSemester,
} from "@/features/terms/types";

// Two consecutive 4-digit years, e.g. "2026-2027".
const SCHOOL_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

function isValidSchoolYear(value: string): boolean {
  const match = SCHOOL_YEAR_PATTERN.exec(value.trim());
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}

// Term dates can be current/future, so widen the calendar and allow any date.
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
  const [semester, setSemester] = useState<TermSemester | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const create = useCreateTerm();

  const schoolYearValid = isValidSchoolYear(schoolYear);
  const datesValid =
    startDate !== "" && endDate !== "" && endDate >= startDate;
  const canCreate = schoolYearValid && Boolean(semester) && datesValid;

  function reset() {
    setSchoolYear("");
    setSemester("");
    setStartDate("");
    setEndDate("");
    create.reset();
  }

  async function handleCreate() {
    if (!canCreate) return;
    try {
      await create.mutateAsync({
        schoolYear: schoolYear.trim(),
        semester: semester as TermSemester,
        startDate,
        endDate,
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
          <DialogTitle>New term</DialogTitle>
          <DialogDescription>
            Add a school year and semester. Open it to start enrollment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
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
            <FieldLabel htmlFor="semester" required>
              Semester
            </FieldLabel>
            <Select
              value={semester}
              onValueChange={(value) => setSemester(value as TermSemester)}
            >
              <SelectTrigger id="semester" className="w-full">
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                {TERM_SEMESTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabledDates={startDate ? { before: new Date(`${startDate}T00:00:00`) } : []}
            />
            {startDate !== "" && endDate !== "" && endDate < startDate && (
              <p className="text-destructive text-xs">
                The end date must be on or after the start date.
              </p>
            )}
          </div>
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
          <Button onClick={handleCreate} disabled={!canCreate || create.isPending}>
            {create.isPending ? "Adding…" : "Add term"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TermsPage() {
  const { data, isLoading, isError, refetch } = useTerms();
  const terms = data ?? [];
  const openTerm = terms.find((term) => term.isOpen);

  const setOpen = useSetTermOpen();
  const remove = useDeleteTerm();

  const [newTermOpen, setNewTermOpen] = useState(false);
  const [deleting, setDeleting] = useState<Term | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
    } catch {
      // no-op
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Academic Terms
          </h1>
          <p className="text-muted-foreground text-sm">
            Set the school year and semester, and open one for enrollment.
          </p>
        </div>
        <Button onClick={() => setNewTermOpen(true)}>
          <PlusIcon />
          New term
        </Button>
      </div>

      {!isLoading && !isError && (
        <div className="bg-muted/40 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <CalendarDaysIcon className="text-muted-foreground size-4 shrink-0" />
          {openTerm ? (
            <span>
              Enrollment is open for{" "}
              <span className="font-medium">{termLabel(openTerm)}</span>.
            </span>
          ) : (
            <span className="text-muted-foreground">
              No term is currently open for enrollment.
            </span>
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
            We couldn't load terms. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : terms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No terms yet</p>
          <p className="text-muted-foreground text-sm">
            Add a term to begin setting up enrollment.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Year</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">
                    {term.schoolYear}
                  </TableCell>
                  <TableCell>{semesterLabel(term.semester)}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {term.startDate && term.endDate
                      ? `${formatDate(term.startDate)} – ${formatDate(term.endDate)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        term.isOpen
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
                      )}
                    >
                      {term.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setOpen.isPending}
                        onClick={() =>
                          setOpen.mutate({ id: term.id, isOpen: !term.isOpen })
                        }
                      >
                        {term.isOpen ? "Close" : "Open"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-8"
                        onClick={() => setDeleting(term)}
                      >
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">Delete term</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewTermDialog open={newTermOpen} onOpenChange={setNewTermOpen} />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this term?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${termLabel(deleting)} will be removed. This can't be undone.`
                : ""}
              {deleting?.isOpen && (
                <span className="text-destructive mt-2 flex items-center gap-1.5">
                  <CircleAlertIcon className="size-4" />
                  This term is currently open for enrollment.
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
    </div>
  );
}

export default TermsPage;
