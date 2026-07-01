import { Fragment, useMemo, useState } from "react";
import {
  CoinsIcon,
  GraduationCapIcon,
  LibraryIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  FEE_CATEGORY_OPTIONS,
  FEE_TYPE_OPTIONS,
  FEE_YEAR_LEVEL_OPTIONS,
  feeYearLevelLabel,
  type FeeCategory,
  type FeeInput,
  type FeeType,
  type FeeYearLevel,
  type SchoolYearFee,
} from "@/features/fees/types";

interface FeeFormState {
  yearLevel: FeeYearLevel;
  category: FeeCategory;
  name: string;
  type: FeeType;
  amount: string;
}

const EMPTY_FEE: FeeFormState = {
  yearLevel: "all",
  category: "other",
  name: "",
  type: "default",
  amount: "",
};

// Per-category presentation (icon + colour chip) for the breakdown cards.
const CATEGORY_META: Record<string, { icon: LucideIcon }> = {
  tuition: { icon: GraduationCapIcon },
  miscellaneous: { icon: LibraryIcon },
  other: { icon: CoinsIcon },
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
          category: editing.category,
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
      category: form.category,
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
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel required>Category</FieldLabel>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, category: v as FeeCategory }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

  // Fees grouped by category (in schedule order) with a subtotal each, mirroring
  // the official Schedule of Fees breakdown.
  const groups = useMemo(() => {
    const rows = data ?? [];
    return FEE_CATEGORY_OPTIONS.map((cat) => {
      const items = rows
        .filter((f) => f.category === cat.value)
        .sort((a, b) => a.sequence - b.sequence);
      return {
        ...cat,
        items,
        subtotal: items.reduce((sum, f) => sum + f.amount, 0),
      };
    }).filter((group) => group.items.length > 0);
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
              <SelectTrigger className="min-w-44 w-fit">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((sy) => (
                  <SelectItem key={sy.id} value={String(sy.id)}>
                    SY {sy.schoolYear}
                    {sy.isActive ? " - active" : ""}
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

      {effectiveId === null ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No school year selected</p>
          <p className="text-muted-foreground text-sm">
            Create and activate a school year first.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
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
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Fee</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead className="px-4 text-right">Amount</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const meta = CATEGORY_META[group.value] ?? CATEGORY_META.other;
                const Icon = meta.icon;
                return (
                  <Fragment key={group.value}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={2} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Icon className="text-muted-foreground size-4" />
                          <span className="font-semibold">{group.label}</span>
                          <span className="text-muted-foreground text-xs">
                            {group.items.length}{" "}
                            {group.items.length === 1 ? "item" : "items"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 text-right font-semibold tabular-nums">
                        {formatPeso(group.subtotal)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    {group.items.map((fee) => (
                      <TableRow key={fee.id} className="group">
                        <TableCell className="px-4 font-medium">
                          {fee.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            {fee.yearLevel === "all"
                              ? "All levels"
                              : feeYearLevelLabel(fee.yearLevel)}
                            {fee.type === "add_on" && (
                              <Badge variant="outline" className="font-normal">
                                Add-on
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 text-right font-medium tabular-nums">
                          {formatPeso(fee.amount)}
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openEdit(fee)}
                              aria-label={`Edit ${fee.name}`}
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive size-7"
                              onClick={() => setDeleting(fee)}
                              aria-label={`Delete ${fee.name}`}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
            <TableFooter className="border-t-2 bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="text-muted-foreground px-4 py-3 text-xs font-medium tracking-wide uppercase"
                >
                  Grade 11 / student
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-base font-semibold tabular-nums">
                  {formatPeso(totals.grade11)}
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow className="border-t-0 hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="text-muted-foreground px-4 py-3 text-xs font-medium tracking-wide uppercase"
                >
                  Grade 12 / student
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-base font-semibold tabular-nums">
                  {formatPeso(totals.grade12)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
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
