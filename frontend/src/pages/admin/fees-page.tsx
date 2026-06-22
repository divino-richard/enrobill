import { useMemo, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
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
import { formatPeso } from "@/lib/money";
import { getErrorMessage } from "@/lib/get-error-message";
import { useTerms } from "@/features/terms/hooks";
import {
  useCreateFee,
  useDeleteFee,
  useFees,
  useUpdateFee,
} from "@/features/fees/hooks";
import {
  FEE_TYPE_OPTIONS,
  FEE_YEAR_LEVEL_OPTIONS,
  feeTypeLabel,
  feeYearLevelLabel,
  type FeeInput,
  type FeeType,
  type FeeYearLevel,
  type SchoolYearFee,
} from "@/features/fees/types";

interface FeeFormState {
  yearLevel: FeeYearLevel;
  name: string;
  type: FeeType;
  amount: string;
}

const EMPTY_FEE: FeeFormState = {
  yearLevel: "all",
  name: "",
  type: "default",
  amount: "",
};

function FeeDialog({
  open,
  schoolYearId,
  editing,
  onOpenChange,
}: {
  open: boolean;
  schoolYearId: number | null;
  editing: SchoolYearFee | null;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateFee();
  const update = useUpdateFee(editing?.id ?? 0);
  const mutation = editing ? update : create;

  const [form, setForm] = useState<FeeFormState>(
    editing
      ? {
          yearLevel: editing.yearLevel,
          name: editing.name,
          type: editing.type,
          amount: String(editing.amount),
        }
      : EMPTY_FEE,
  );

  const valid = form.name.trim() !== "" && form.amount !== "";

  async function handleSave() {
    if (!valid) return;
    const payload: FeeInput = {
      yearLevel: form.yearLevel,
      name: form.name.trim(),
      type: form.type,
      amount: Number(form.amount),
      ...(editing ? {} : { schoolYearId: schoolYearId ?? undefined }),
    };
    try {
      await mutation.mutateAsync(payload);
      onOpenChange(false);
    } catch {
      // Surfaced via mutation.isError.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit fee" : "Add fee"}</DialogTitle>
          <DialogDescription>
            Fees apply by year level. Use “All levels” for fees everyone pays, or
            target a level (e.g. a Grade 12 add-on).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel required>Year level</FieldLabel>
            <Select
              value={form.yearLevel}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, yearLevel: v as FeeYearLevel }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_YEAR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Type</FieldLabel>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, type: v as FeeType }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel required>Fee name</FieldLabel>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Tuition"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Amount (₱)</FieldLabel>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: e.target.value }))
              }
            />
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
            {mutation.isPending ? "Saving…" : editing ? "Save" : "Add fee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeesPage() {
  const { data: terms } = useTerms();
  const schoolYears = terms ?? [];
  const activeYear = schoolYears.find((sy) => sy.isActive);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const effectiveId = selectedId ?? activeYear?.id ?? null;

  const { data, isLoading, isError, refetch } = useFees(
    effectiveId ?? undefined,
  );
  const fees = data ?? [];

  const remove = useDeleteFee();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolYearFee | null>(null);
  const [deleting, setDeleting] = useState<SchoolYearFee | null>(null);

  const totals = useMemo(() => {
    const rows = data ?? [];
    const grade11 = rows
      .filter((f) => f.yearLevel === "all" || f.yearLevel === "grade_11")
      .reduce((sum, f) => sum + f.amount, 0);
    const grade12 = rows
      .filter((f) => f.yearLevel === "all" || f.yearLevel === "grade_12")
      .reduce((sum, f) => sum + f.amount, 0);
    return { grade11, grade12 };
  }, [data]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(fee: SchoolYearFee) {
    setEditing(fee);
    setDialogOpen(true);
  }

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>
          <p className="text-muted-foreground text-sm">
            The global fee schedule for a school year, by year level. Bills are
            generated from these.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <FieldLabel>School year</FieldLabel>
            <Select
              value={effectiveId ? String(effectiveId) : ""}
              onValueChange={(v) => setSelectedId(Number(v))}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((sy) => (
                  <SelectItem key={sy.id} value={String(sy.id)}>
                    SY {sy.schoolYear}
                    {sy.isActive ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openAdd} disabled={effectiveId === null}>
            <PlusIcon />
            Add fee
          </Button>
        </div>
      </div>

      {effectiveId !== null && !isLoading && !isError && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">Grade 11 total</p>
            <p className="text-lg font-semibold">{formatPeso(totals.grade11)}</p>
          </div>
          <div className="rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs">Grade 12 total</p>
            <p className="text-lg font-semibold">{formatPeso(totals.grade12)}</p>
          </div>
        </div>
      )}

      {effectiveId === null ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No school year selected</p>
          <p className="text-muted-foreground text-sm">
            Create and activate a school year first.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">
            We couldn't load fees. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : fees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No fees yet</p>
          <p className="text-muted-foreground text-sm">
            Add the fees for this school year so bills can be generated.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee</TableHead>
                <TableHead>Year level</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.name}</TableCell>
                  <TableCell>{feeYearLevelLabel(fee.yearLevel)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={fee.type === "add_on" ? "secondary" : "outline"}
                    >
                      {feeTypeLabel(fee.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPeso(fee.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions>
                      <DropdownMenuItem onClick={() => openEdit(fee)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleting(fee)}
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

      {dialogOpen && (
        <FeeDialog
          open={dialogOpen}
          schoolYearId={effectiveId}
          editing={editing}
          onOpenChange={setDialogOpen}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fee?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `“${deleting.name}” will be removed from this school year's schedule. Existing bills already generated are unaffected.`
                : ""}
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

export default FeesPage;
